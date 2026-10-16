"""Investigators' cases survive a restart: saved after every change, restored on start."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.store import store

DOCK_LOG = (
    b"time,door,event\n"
    b"2026-10-10T06:36:44+01:00,DOCK2,open\n"
    b"2026-10-10T06:39:23+01:00,DOCK2,close\n"
)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("GP_STORAGE_DIR", str(tmp_path / "evidence"))
    monkeypatch.setenv("GP_DATA_DIR", str(tmp_path / "state"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    store.reset()
    return TestClient(app)


def build_case(client) -> str:
    case_id = client.post(
        "/api/cases",
        json={
            "title": "Dock 2 review",
            "scope": "Order of events only",
            "incident_start": "2026-10-10T06:00:00+01:00",
            "incident_end": "2026-10-10T07:30:00+01:00",
        },
    ).json()["case"]["id"]
    client.post(f"/api/cases/{case_id}/evidence", files={"file": ("dock.csv", DOCK_LOG)})
    client.post(f"/api/cases/{case_id}/questions", json={"text": "When was Dock 2 opened?"})
    client.post(
        f"/api/cases/{case_id}/claims",
        json={
            "statement": "Dock 2 opened at 06:36:44",
            "question_id": "Q-01",
            "state": "supported",
            "rationale": "Access log row 1",
            "links": [{"evidence_id": "E-01", "locator": "row 1", "relationship": "supports"}],
        },
    )
    client.post(
        f"/api/cases/{case_id}/conclusions",
        json={
            "answers": [
                {
                    "question_id": "Q-01",
                    "finding": "established",
                    "text": "Dock 2 opened at 06:36:44 per the access log.",
                    "cites": ["CL-01"],
                }
            ],
            "actor": "Femi",
            "attest_sources_reviewed": True,
            "attest_unresolved_stated": True,
        },
    )
    return case_id


def test_a_case_survives_a_restart_with_its_events_claims_and_signature(client, tmp_path):
    case_id = build_case(client)
    before = client.get(f"/api/cases/{case_id}/report?format=json").json()

    # Simulate a restart: the store is rebuilt from the seeds plus whatever was saved,
    # and this container's disk copy of the original is gone.
    for f in (tmp_path / "evidence").rglob("*"):
        if f.is_file():
            f.unlink()
    store.reset()

    after = client.get(f"/api/cases/{case_id}")
    assert after.status_code == 200
    assert after.json()["event_count"] == 2
    assert client.get(f"/api/cases/{case_id}/conclusions").json()[0]["signed_by"] == "Femi"
    assert client.get(f"/api/cases/{case_id}/journey").json()["steps"][-1]["done"] is True
    # The original bytes came back from the saved blob and still match their hash.
    original = client.get(f"/api/cases/{case_id}/evidence/E-01/file")
    assert original.status_code == 200 and original.content == DOCK_LOG
    rebuilt = client.get(f"/api/cases/{case_id}/report?format=json").json()
    assert rebuilt["sections"] == before["sections"]


def test_new_cases_continue_numbering_after_a_restart(client):
    first = build_case(client)
    store.reset()
    second = client.post(
        "/api/cases",
        json={
            "title": "Next",
            "incident_start": "2026-10-10T06:00:00+01:00",
            "incident_end": "2026-10-10T07:00:00+01:00",
        },
    ).json()["case"]["id"]
    assert (first, second) == ("CASE-002", "CASE-003")


def test_the_demo_case_is_never_saved_so_the_seed_always_wins(client, tmp_path):
    client.post("/api/cases/CASE-001/staged/E-07")
    assert not (tmp_path / "state" / "cases" / "CASE-001.json").exists()
    store.reset()
    assert client.get("/api/cases/CASE-001").json()["evidence_count"] == 6


def test_unchanged_cases_are_not_rewritten(client):
    build_case(client)
    assert store.save() == []
