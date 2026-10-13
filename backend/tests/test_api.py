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


def test_placeholders_return_501(client):
    assert client.get("/api/cases/CASE-001/report").status_code == 501
