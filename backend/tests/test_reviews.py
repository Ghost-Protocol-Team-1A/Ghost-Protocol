import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.store import store


@pytest.fixture()
def client():
    store.reset()
    return TestClient(app)


def review(client, **body):
    return client.post("/api/cases/CASE-001/reviews", json=body)


def test_conflict_status_change_is_recorded_and_audited(client):
    res = review(
        client, target_id="C-02", status="resolved", note="Offset confirmed against NTP log."
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "resolved"
    assert body["reviews"][0]["note"] == "Offset confirmed against NTP log."
    assert body["reviews"][0]["actor"] == "BJ"
    summary = client.get("/api/cases/CASE-001").json()
    assert summary["open_conflicts"] == 2
    top = client.get("/api/cases/CASE-001/audit").json()[0]
    assert top["action"] == "Review recorded" and top["entity_ref"] == "C-02"
    assert "status → resolved" in top["details"]


def test_review_survives_live_evidence_reanalysis(client):
    review(client, target_id="C-01", status="under_review", note="Asked for the import job log.")
    client.post("/api/cases/CASE-001/staged/E-07")
    c01 = {c["id"]: c for c in client.get("/api/cases/CASE-001/conflicts").json()}["C-01"]
    assert c01["status"] == "under_review"
    assert len(c01["reviews"]) == 1


def test_hypothesis_takes_notes_but_not_status(client):
    ok = review(client, target_id="H-02", note="Request edit history from inventory team.")
    assert ok.status_code == 201 and ok.json()["reviews"][0]["status"] is None
    bad = review(client, target_id="H-02", status="resolved", note="Trying to force a status.")
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "invalid_review"


@pytest.mark.parametrize(
    "body,code",
    [
        ({"target_id": "C-99", "note": "Unknown conflict"}, 404),
        ({"target_id": "X-01", "note": "Bad target format"}, 422),
        ({"target_id": "C-01", "note": "no"}, 422),
    ],
)
def test_bad_reviews_are_rejected(client, body, code):
    assert review(client, **body).status_code == code


def test_reset_clears_reviews(client):
    review(client, target_id="C-02", status="resolved", note="Offset confirmed against NTP log.")
    client.post("/api/demo/reset")
    c02 = {c["id"]: c for c in client.get("/api/cases/CASE-001/conflicts").json()}["C-02"]
    assert c02["status"] == "open" and c02["reviews"] == []
