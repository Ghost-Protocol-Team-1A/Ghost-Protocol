import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.store import store


@pytest.fixture()
def client():
    store.reset()
    return TestClient(app)


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
    import hashlib

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
