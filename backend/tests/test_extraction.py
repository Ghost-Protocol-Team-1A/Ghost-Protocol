"""Uploaded evidence becomes events: logs are parsed, recordings get observations and clocks."""

import struct
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.extract import media_start_time, parse_log, read_time
from app.services.store import store

WINDOW = "2026-10-10T06:00:00+01:00"
DOCK_LOG = (
    b"time,door,event\n"
    b"2026-10-10T06:36:44+01:00,DOCK2,open\n"
    b"2026-10-10T06:39:23+01:00,DOCK2,close\n"
)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("GP_STORAGE_DIR", str(tmp_path))
    store.reset()
    return TestClient(app)


def new_case(client):
    body = {
        "title": "Loading dock review",
        "incident_start": "2026-10-10T06:00:00+01:00",
        "incident_end": "2026-10-10T07:30:00+01:00",
        "classification": "internal",
    }
    return client.post("/api/cases", json=body).json()["case"]["id"]


def upload(client, case_id, name, content):
    return client.post(f"/api/cases/{case_id}/evidence", files={"file": (name, content)})


def mp4_with_start(when: datetime) -> bytes:
    seconds = int((when - datetime(1904, 1, 1, tzinfo=UTC)).total_seconds())
    mvhd = b"mvhd" + b"\x00\x00\x00\x00" + struct.pack(">II", seconds, seconds) + bytes(80)
    moov = struct.pack(">I", 8 + 4 + len(mvhd)) + b"moov" + struct.pack(">I", 4 + len(mvhd)) + mvhd
    return b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + moov


# --- parsing -------------------------------------------------------------------------------------


def test_csv_rows_with_a_time_column_become_events():
    data = b"row,time,door,event\n1,2026-10-10 06:36:44,DOCK2,open\n2,,DOCK2,close\n"
    result = parse_log("csv", data, WINDOW)
    assert result.time_field == "time"
    assert len(result.rows) == 1 and result.skipped_no_time == 1
    row = result.rows[0]
    assert row.source_time == "2026-10-10T06:36:44+01:00"
    assert row.timezone_assumed is True
    assert row.locator == "row 1"
    assert "DOCK2" in row.description and "open" in row.description


def test_json_lists_and_wrapped_lists_are_read():
    flat = b'[{"ts": "2026-10-10T05:40:00Z", "scanner": "S2", "status": "offline"}]'
    wrapped = b'{"events": [{"logged_at": "2026-10-10T06:40:00+01:00", "msg": "scan ok"}]}'
    assert parse_log("json", flat, WINDOW).rows[0].source_time == "2026-10-10T05:40:00+00:00"
    assert parse_log("json", wrapped, WINDOW).rows[0].description == "scan ok"


def test_text_logs_take_the_time_at_the_start_of_each_line():
    data = b"[2026-10-10 06:41:02] door DOCK2 closed\nno time on this line\n"
    result = parse_log("text", data, WINDOW)
    assert [r.locator for r in result.rows] == ["line 1"]
    assert result.rows[0].description == "door DOCK2 closed"
    assert result.skipped_no_time == 1


def test_a_time_without_a_date_is_never_guessed():
    assert read_time("06:41:02", "+01:00") is None
    assert parse_log("csv", b"time,event\n06:41,open\n", WINDOW).rows == []


def test_media_start_time_is_read_from_the_file():
    when = datetime(2026, 10, 10, 5, 38, 2, tzinfo=UTC)
    assert media_start_time(mp4_with_start(when)) == "2026-10-10T05:38:02Z"
    assert media_start_time(b"\x00\x00\x00\x18ftypmp42") is None


# --- upload, observations and clocks ------------------------------------------------------------


def test_an_uploaded_log_adds_events_and_says_what_changed(client):
    case_id = new_case(client)
    log = DOCK_LOG
    res = upload(client, case_id, "dock_access.csv", log)
    assert res.status_code == 201
    body = res.json()
    assert body["processing_status"] == "extracted"
    assert body["change"]["added_events"] == [f"{body['id']}-R1", f"{body['id']}-R2"]
    timeline = client.get(f"/api/cases/{case_id}/timeline").json()
    assert [e["locator"] for e in timeline] == ["row 1", "row 2"]


def test_observations_use_the_recordings_own_start_time(client):
    case_id = new_case(client)
    video = mp4_with_start(datetime(2026, 10, 10, 5, 38, 2, tzinfo=UTC))
    item = upload(client, case_id, "dock_cam.mp4", video).json()
    assert item["recorded_at"] == "2026-10-10T05:38:02Z"
    assert item["clock"]["method"] == "not_set"

    res = client.post(
        f"/api/cases/{case_id}/evidence/{item['id']}/observations",
        json={
            "timecode": "00:39",
            "description": "Forklift enters with a pallet",
            "actor": "Adaeze",
        },
    )
    assert res.status_code == 201
    event = res.json()["event"]
    assert event["normalized_time"] == "2026-10-10T05:38:41Z"
    assert event["extracted_by"] == "Adaeze"
    assert "not verified" in event["normalization_rule"]
    audit = client.get(f"/api/cases/{case_id}/audit").json()
    assert audit[0]["actor"] == "Adaeze" and audit[0]["action"] == "Observation logged"


def test_an_observation_needs_a_time_when_the_file_has_none(client):
    case_id = new_case(client)
    item = upload(client, case_id, "clip.mp4", b"\x00\x00\x00\x18ftypmp42" + bytes(64)).json()
    url = f"/api/cases/{case_id}/evidence/{item['id']}/observations"
    missing = client.post(url, json={"timecode": "01:00", "description": "Door closes"})
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "source_time_needed"
    given = client.post(
        url,
        json={
            "timecode": "01:00",
            "description": "Door closes",
            "source_time": "2026-10-10T06:40:53+01:00",
        },
    )
    assert given.status_code == 201


def test_matching_moments_infer_the_camera_offset_and_raise_rule_time_002(client):
    case_id = new_case(client)
    log = DOCK_LOG
    log_id = upload(client, case_id, "dock_access.csv", log).json()["id"]
    cam = upload(client, case_id, "dock_cam.mp4", b"\x00\x00\x00\x18ftypmp42" + bytes(64)).json()[
        "id"
    ]
    obs = f"/api/cases/{case_id}/evidence/{cam}/observations"
    a = client.post(
        obs,
        json={
            "timecode": "00:12",
            "description": "Door opens",
            "source_time": "2026-10-10T06:38:14+01:00",
        },
    ).json()["event"]["id"]
    b = client.post(
        obs,
        json={
            "timecode": "02:51",
            "description": "Door closes",
            "source_time": "2026-10-10T06:40:53+01:00",
        },
    ).json()["event"]["id"]

    res = client.put(
        f"/api/cases/{case_id}/evidence/{cam}/clock",
        json={
            "method": "anchors",
            "anchors": {a: f"{log_id}-R1", b: f"{log_id}-R2"},
            "actor": "Adaeze",
        },
    )
    assert res.status_code == 200
    assert "90" in res.json()["trigger"]
    events = {e["id"]: e for e in client.get(f"/api/cases/{case_id}/timeline").json()}
    assert events[a]["normalized_time"] == events[f"{log_id}-R1"]["normalized_time"]
    rules = [c["rule_id"] for c in client.get(f"/api/cases/{case_id}/conflicts").json()]
    assert "RULE-TIME-002" in rules


def test_a_declared_offset_re_times_events_and_raises_rule_time_001(client):
    case_id = new_case(client)
    cam = upload(client, case_id, "dock_cam.mp4", b"\x00\x00\x00\x18ftypmp42" + bytes(64)).json()[
        "id"
    ]
    obs = f"/api/cases/{case_id}/evidence/{cam}/observations"
    client.post(
        obs,
        json={
            "timecode": "00:12",
            "description": "Door opens",
            "source_time": "2026-10-10T06:38:14+01:00",
        },
    )
    res = client.put(
        f"/api/cases/{case_id}/evidence/{cam}/clock",
        json={"method": "declared", "offset_seconds": 90},
    )
    assert res.status_code == 200
    event = client.get(f"/api/cases/{case_id}/timeline").json()[0]
    assert event["normalized_time"] == "2026-10-10T05:36:44Z"
    assert "declared by investigator" in event["normalization_rule"]
    assert [c["rule_id"] for c in client.get(f"/api/cases/{case_id}/conflicts").json()] == [
        "RULE-TIME-001"
    ]


def test_anchors_must_point_at_a_trusted_source(client):
    case_id = new_case(client)
    cam = upload(client, case_id, "cam.mp4", b"\x00\x00\x00\x18ftypmp42" + bytes(64)).json()["id"]
    obs = f"/api/cases/{case_id}/evidence/{cam}/observations"
    a = client.post(
        obs,
        json={
            "timecode": "00:12",
            "description": "Door",
            "source_time": "2026-10-10T06:38:14+01:00",
        },
    ).json()["event"]["id"]
    res = client.put(
        f"/api/cases/{case_id}/evidence/{cam}/clock", json={"method": "anchors", "anchors": {a: a}}
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "bad_anchor"


def test_observations_are_only_for_recordings(client):
    case_id = new_case(client)
    pdf = upload(client, case_id, "statement.pdf", b"%PDF-1.7\n").json()["id"]
    res = client.post(
        f"/api/cases/{case_id}/evidence/{pdf}/observations",
        json={"timecode": "00:01", "description": "x y z"},
    )
    assert res.json()["error"]["code"] == "not_a_recording"
