"""Questions, claims and the signed conclusion: findings stay tied to evidence."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.store import store

BASE = "/api/cases/CASE-001"


@pytest.fixture()
def client():
    store.reset()
    return TestClient(app)


def decide_all_conflicts(client):
    for c in client.get(f"{BASE}/conflicts").json():
        client.post(
            f"{BASE}/reviews",
            json={"target_id": c["id"], "note": "Reviewed against sources.", "status": "resolved"},
        )


ANSWERS = [
    {
        "question_id": "Q-01",
        "finding": "established",
        "text": "Door 21:12, trolley 21:14, alarm 21:16; the 21:09 row is a copy, not an event.",
        "cites": ["CL-01", "CL-02", "C-01"],
    },
    {
        "question_id": "Q-02",
        "finding": "partly_established",
        "text": "Likely the bay door: the alarm follows it, but the audio does not name a door.",
        "cites": ["CL-03"],
    },
    {
        "question_id": "Q-03",
        "finding": "not_established",
        "text": "The object on the trolley is obscured and no source links a person to a badge.",
        "cites": ["CL-04", "CL-06"],
    },
]


def sign(client, answers=ANSWERS, **over):
    body = {
        "answers": answers,
        "actor": "Judge Adaeze",
        "role": "reviewer",
        "attest_sources_reviewed": True,
        "attest_unresolved_stated": True,
        **over,
    }
    return client.post(f"{BASE}/conclusions", json=body)


def test_case_001_starts_with_three_questions_linked_to_its_claims(client):
    questions = client.get(f"{BASE}/questions").json()
    assert [q["id"] for q in questions] == ["Q-01", "Q-02", "Q-03"]
    claims = {c["id"]: c["question_id"] for c in client.get(f"{BASE}/claims").json()}
    assert claims["CL-04"] == "Q-03"


def test_a_claims_state_must_match_its_citations(client):
    bad = client.post(
        f"{BASE}/claims",
        json={
            "statement": "The door opened twice",
            "state": "supported",
            "rationale": "Seen twice",
        },
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "state_not_supported_by_citations"
    ok = client.post(
        f"{BASE}/claims",
        json={
            "statement": "The door opened at 21:12",
            "question_id": "Q-01",
            "state": "supported",
            "rationale": "Access log row 18",
            "links": [{"evidence_id": "E-04", "locator": "row 18", "relationship": "supports"}],
            "actor": "Femi",
        },
    )
    assert ok.status_code == 201
    assert ok.json()["id"] == "CL-07" and ok.json()["created_by"] == "Femi"
    unknown = client.post(
        f"{BASE}/claims",
        json={
            "statement": "Something else",
            "state": "supported",
            "rationale": "From a file",
            "links": [{"evidence_id": "E-99", "relationship": "supports"}],
        },
    )
    assert unknown.json()["error"]["code"] == "unknown_evidence"


def test_inferred_needs_two_citations(client):
    one = client.post(
        f"{BASE}/claims",
        json={
            "statement": "The alarm was the bay door",
            "state": "inferred",
            "rationale": "Timing",
            "links": [{"evidence_id": "E-03", "relationship": "supports"}],
        },
    )
    assert one.status_code == 422


def test_questions_are_added_once(client):
    url = f"{BASE}/questions"
    assert client.post(url, json={"text": "Who held badge B-117?"}).json()["id"] == "Q-04"
    assert client.post(url, json={"text": "who held  badge B-117?"}).status_code == 409


def test_signing_waits_for_every_conflict_to_be_decided(client):
    res = sign(client)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "open_conflicts"


def test_established_must_rest_on_a_supported_claim(client):
    decide_all_conflicts(client)
    answers = [dict(ANSWERS[0], cites=["CL-04"]), ANSWERS[1], ANSWERS[2]]
    res = sign(client, answers)
    assert res.json()["error"]["code"] == "established_needs_support"


def test_every_question_is_answered_exactly_once_and_citations_exist(client):
    decide_all_conflicts(client)
    assert sign(client, ANSWERS[:2]).json()["error"]["details"]["missing"] == ["Q-03"]
    bad_cite = [ANSWERS[0], dict(ANSWERS[1], cites=["CL-99"]), ANSWERS[2]]
    assert sign(client, bad_cite).json()["error"]["code"] == "unknown_citation"
    assert sign(client, attest_unresolved_stated=False).json()["error"]["code"] == (
        "attestation_required"
    )


def test_a_signed_conclusion_is_versioned_audited_and_reported(client):
    decide_all_conflicts(client)
    first = sign(client)
    assert first.status_code == 201
    assert first.json()["id"] == "CON-1" and first.json()["signed_by"] == "Judge Adaeze"
    second = sign(client)
    assert second.json()["version"] == 2 and second.json()["supersedes"] == "CON-1"
    assert len(client.get(f"{BASE}/conclusions").json()) == 2

    audit = client.get(f"{BASE}/audit").json()
    assert audit[0]["action"] == "Conclusion signed" and audit[0]["actor"] == "Judge Adaeze"

    report = client.get(f"{BASE}/report?format=json").json()
    sections = {s["id"]: s for s in report["sections"]}
    q3 = next(i for i in sections["findings"]["items"] if i["id"] == "Q-03")
    assert q3["finding"] == "Not established"
    assert sections["signoff"]["facts"][0]["value"] == "Judge Adaeze (reviewer)"
    md = client.get(f"{BASE}/report?format=md").text
    assert "Sign-off" in md and "supersedes CON-1" in md


def test_the_journey_points_at_the_next_thing_to_do(client):
    journey = client.get(f"{BASE}/journey").json()
    steps = {s["key"]: s for s in journey["steps"]}
    assert [s["key"] for s in journey["steps"]] == [
        "scope",
        "evidence",
        "extract",
        "timeline",
        "questions",
        "conclude",
    ]
    assert steps["extract"]["done"] is True
    assert journey["current"] == "timeline"
    assert "3 conflicts to decide" in steps["timeline"]["detail"]

    decide_all_conflicts(client)
    sign(client)
    done = client.get(f"{BASE}/journey").json()
    assert all(s["done"] for s in done["steps"])
    assert done["next_href"] == "/cases/CASE-001/report"


def test_a_new_case_journey_starts_at_evidence(client):
    case_id = client.post(
        "/api/cases",
        json={
            "title": "Dock review",
            "scope": "Order of events only",
            "incident_start": "2026-10-10T06:00:00+01:00",
            "incident_end": "2026-10-10T07:30:00+01:00",
        },
    ).json()["case"]["id"]
    journey = client.get(f"/api/cases/{case_id}/journey").json()
    assert journey["current"] == "evidence"
    assert journey["next_href"] == f"/cases/{case_id}/intake"
