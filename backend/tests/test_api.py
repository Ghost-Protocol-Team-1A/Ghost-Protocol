import hashlib
import shutil
import subprocess

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.store import store

CSV_BYTES = (
    b"row,timestamp,badge_id,door,event_code\n"
    b"1,2026-10-10T21:00:00+01:00,B-99,front,DOOR_OPEN\n"
)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # Uploads are content-addressed on disk; point the store at a throwaway directory so a
    # test never writes into the repository or sees bytes left behind by an earlier run.
    monkeypatch.setenv("GP_STORAGE_DIR", str(tmp_path))
    store.reset()
    return TestClient(app)


def upload(client, name, content):
    return client.post("/api/cases/CASE-001/evidence", files={"file": (name, content)})


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_case_summary(client):
    body = client.get("/api/cases/CASE-001").json()
    assert body["evidence_count"] == 6
    assert body["open_conflicts"] == 3
    assert body["case"]["fictional"] is True


def test_timeline_shows_both_times(client):
    events = {e["id"]: e for e in client.get("/api/cases/CASE-001/timeline").json()}
    assert events["EV-014"]["source_time"].startswith("2026-10-10T21:16:00")
    assert events["EV-014"]["normalized_time"] == "2026-10-10T20:14:00Z"


def test_conflicts_endpoint(client):
    ids = [c["id"] for c in client.get("/api/cases/CASE-001/conflicts").json()]
    assert ids == ["C-01", "C-02", "C-03"]


def test_unknown_case_uses_error_shape(client):
    res = client.get("/api/cases/CASE-999/timeline")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "case_not_found"


def test_reset_restores_state_and_logs_it(client):
    client.post("/api/demo/reset")
    audit = client.get("/api/cases/CASE-001/audit").json()
    assert audit[0]["action"] == "Demo reset"
    assert client.get("/api/cases/CASE-001").json()["evidence_count"] == 6


def test_original_log_rows_match_the_hash(client):
    from app.services.ingest import SEED_ROOT

    body = client.get("/api/cases/CASE-001/evidence/E-04/original").json()
    assert body["columns"][:3] == ["row", "timestamp", "badge_id"]
    assert body["rows"][17]["timestamp"] == "2026-10-10T21:12:00+01:00"
    raw = (SEED_ROOT / "case_001" / body["filename"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == body["sha256"]


def test_simulated_evidence_has_no_original(client):
    res = client.get("/api/cases/CASE-001/evidence/E-02/original")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "original_not_available"


def test_live_evidence_reports_what_changed_and_what_did_not(client):
    assert [s["evidence_id"] for s in client.get("/api/cases/CASE-001/staged").json()] == ["E-07"]

    res = client.post("/api/cases/CASE-001/staged/E-07")
    assert res.status_code == 201
    change = res.json()
    assert change["added_evidence"] == ["E-07"]
    assert change["added_claims"] == ["CL-07"]
    assert change["conflicts_added"] == [] and change["conflicts_removed"] == []
    assert any(u.startswith("CL-06 still unresolved") for u in change["unchanged"])
    assert "Conflicts unchanged: C-01, C-02, C-03" in change["unchanged"]

    assert client.get("/api/cases/CASE-001").json()["evidence_count"] == 7
    assert client.get("/api/cases/CASE-001/staged").json() == []
    assert client.post("/api/cases/CASE-001/staged/E-07").status_code == 409
    assert len(client.get("/api/cases/CASE-001/changes").json()) == 1


def test_reset_removes_live_evidence(client):
    client.post("/api/cases/CASE-001/staged/E-07")
    client.post("/api/demo/reset")
    assert client.get("/api/cases/CASE-001").json()["evidence_count"] == 6
    assert client.get("/api/cases/CASE-001/changes").json() == []


def test_create_case_starts_empty_and_is_audited(client):
    res = client.post(
        "/api/cases",
        json={
            "title": "Loading dock review",
            "incident_start": "2026-10-12T08:00:00+01:00",
            "incident_end": "2026-10-12T09:00:00+01:00",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["case"]["id"] == "CASE-002"
    assert body["evidence_count"] == 0 and body["open_conflicts"] == 0
    assert body["case"]["fictional"] is False
    assert client.get("/api/cases/CASE-002/timeline").json() == []
    assert client.get("/api/cases/CASE-002/staged").json() == []
    assert client.get("/api/cases/CASE-002/audit").json()[0]["action"] == "Case created"


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "ab", "incident_start": "2026-10-12T08:00:00+01:00",
         "incident_end": "2026-10-12T09:00:00+01:00"},
        {"title": "Valid title", "incident_start": "2026-10-12T09:00:00+01:00",
         "incident_end": "2026-10-12T08:00:00+01:00"},
        {"title": "Valid title", "incident_start": "2026-10-12T08:00:00",
         "incident_end": "2026-10-12T09:00:00"},
    ],
)
def test_create_case_rejects_bad_input(client, payload):
    res = client.post("/api/cases", json=payload)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_request"


def test_reset_removes_created_cases(client):
    client.post(
        "/api/cases",
        json={"title": "Temporary", "incident_start": "2026-10-12T08:00:00+01:00",
              "incident_end": "2026-10-12T09:00:00+01:00"},
    )
    client.post("/api/demo/reset")
    assert [c["case"]["id"] for c in client.get("/api/cases").json()] == ["CASE-001"]


# --- evidence upload: the storage checks end to end through the API ---------------------------


def test_a_valid_csv_upload_is_stored_provably(tmp_path, client):
    res = upload(client, "shift-log.csv", CSV_BYTES)
    assert res.status_code == 201
    body = res.json()
    assert body["duplicate"] is False
    assert body["type"] == "csv"
    assert body["original_filename"] == "shift-log.csv"
    assert body["size_bytes"] == len(CSV_BYTES)
    assert body["processing_status"] == "queued"

    # The hash in the API response matches shasum -a 256 of the file (acceptance for issue #3).
    assert body["sha256"] == hashlib.sha256(CSV_BYTES).hexdigest()
    tool = shutil.which("shasum") or shutil.which("sha256sum")
    if tool:
        path = tmp_path / "upload-target"
        path.write_bytes(CSV_BYTES)
        argv = [tool, "-a", "256", str(path)] if "shasum" in tool else [tool, str(path)]
        reported = subprocess.run(argv, capture_output=True, text=True, check=True).stdout
        assert reported.split()[0] == body["sha256"]

    # Stored under the digest alone, sharded, exactly as hashed.
    digest = body["sha256"]
    stored = tmp_path / digest[:2] / digest
    assert stored.read_bytes() == CSV_BYTES

    # Registered in the case: inventory, report input and audit trail all see it.
    ids = [e["id"] for e in client.get("/api/cases/CASE-001/evidence").json()]
    assert body["id"] in ids  # E-07 is staged, so the first upload is E-08
    assert client.get("/api/cases/CASE-001").json()["evidence_count"] == 7
    assert client.get("/api/cases/CASE-001/audit").json()[0]["action"] == "Evidence uploaded"

    # Its original rows are readable in the evidence viewer, like a seeded CSV.
    original = client.get(f"/api/cases/CASE-001/evidence/{body['id']}/original").json()
    assert original["columns"] == ["row", "timestamp", "badge_id", "door", "event_code"]
    assert original["rows"][0]["badge_id"] == "B-99"
    assert original["sha256"] == body["sha256"]


def test_a_traversal_filename_never_reaches_the_filesystem(tmp_path, client):
    res = upload(client, "../../etc/evil-dir/passwd.csv", CSV_BYTES)
    assert res.status_code == 201
    body = res.json()
    assert body["original_filename"] == "passwd.csv"

    digest = body["sha256"]
    path = tmp_path / digest[:2] / digest
    assert path.is_relative_to(tmp_path)
    assert path.name == digest
    for fragment in ("evil", "passwd", "csv", "dir", ".."):
        assert fragment not in str(path.relative_to(tmp_path))


def test_an_executable_renamed_to_pdf_is_rejected(client):
    res = upload(client, "audit.pdf", b"MZ\x90\x00\x03\x00\x00\x00")
    assert res.status_code == 415
    error = res.json()["error"]
    assert error["code"] == "type_mismatch"
    assert "windows executable" in error["details"]["detected"]


def test_an_oversize_upload_is_refused(client, monkeypatch):
    monkeypatch.setenv("MAX_UPLOAD_MB", "1")
    res = upload(client, "huge.csv", b"a" * (1024 * 1024 + 1))
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "file_too_large"


def test_an_empty_upload_is_rejected(client):
    res = upload(client, "empty.csv", b"")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "empty_file"


def test_the_same_file_twice_returns_the_existing_item(client):
    first = upload(client, "shift-log.csv", CSV_BYTES)
    assert first.status_code == 201
    assert first.json()["duplicate"] is False

    second = upload(client, "renamed-copy.csv", CSV_BYTES)
    assert second.status_code == 200  # no second item was created
    assert second.json()["duplicate"] is True
    assert second.json()["id"] == first.json()["id"]

    assert client.get("/api/cases/CASE-001").json()["evidence_count"] == 7
    audit = client.get("/api/cases/CASE-001/audit").json()
    assert audit[0]["action"] == "Duplicate upload skipped"


def test_unknown_case_cannot_receive_evidence(client):
    res = client.post("/api/cases/CASE-999/evidence", files={"file": ("x.csv", CSV_BYTES)})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "case_not_found"


def test_create_case_keeps_scope_and_classification(client):
    res = client.post(
        "/api/cases",
        json={
            "title": "Loading dock review",
            "scope": "Order of door events only",
            "classification": "internal",
            "incident_start": "2026-10-12T08:00:00+01:00",
            "incident_end": "2026-10-12T09:00:00+01:00",
        },
    )
    case = res.json()["case"]
    assert case["scope"] == "Order of door events only"
    assert case["classification"] == "internal"


def test_unknown_classification_is_rejected(client):
    res = client.post(
        "/api/cases",
        json={
            "title": "Loading dock review",
            "classification": "top-secret",
            "incident_start": "2026-10-12T08:00:00+01:00",
            "incident_end": "2026-10-12T09:00:00+01:00",
        },
    )
    assert res.status_code == 422


def test_demo_case_is_marked_synthetic(client):
    case = client.get("/api/cases/CASE-001").json()["case"]
    assert case["classification"] == "synthetic"
    assert "Not in scope" in case["scope"]


# --- original bytes for playback ----------------------------------------------------------------

M4A_BYTES = b"\x00\x00\x00\x1cftypM4A \x00\x00\x00\x00M4A mp42isom" + bytes(range(256)) * 8


def test_a_phone_recording_uploads_and_plays_back_byte_for_byte(client):
    res = upload(client, "voice memo.m4a", M4A_BYTES)
    assert res.status_code == 201
    item = res.json()
    assert item["type"] == "audio"
    assert item["simulated"] is True  # stored and hashed; extraction is not claimed

    played = client.get(f"/api/cases/CASE-001/evidence/{item['id']}/file")
    assert played.status_code == 200
    assert played.content == M4A_BYTES
    assert hashlib.sha256(played.content).hexdigest() == item["sha256"]
    assert played.headers["content-type"] == "audio/mp4"
    assert played.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in played.headers["content-security-policy"]
    assert played.headers["content-disposition"].startswith("inline")


def test_media_supports_range_requests_for_seeking(client):
    item = upload(client, "clip.m4a", M4A_BYTES).json()
    part = client.get(
        f"/api/cases/CASE-001/evidence/{item['id']}/file", headers={"Range": "bytes=0-15"}
    )
    assert part.status_code == 206
    assert part.content == M4A_BYTES[:16]
    assert part.headers["content-range"] == f"bytes 0-15/{len(M4A_BYTES)}"


def test_seeded_logs_are_served_and_simulated_media_is_not(client):
    log = client.get("/api/cases/CASE-001/evidence/E-04/file")
    assert log.status_code == 200
    assert log.content.startswith(b"row,timestamp,badge_id")
    missing = client.get("/api/cases/CASE-001/evidence/E-01/file")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "original_not_available"
    assert client.get("/api/cases/CASE-001/evidence/E-99/file").status_code == 404
