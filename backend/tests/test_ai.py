"""AI assistance: request shape, citation checks, quote checks and human decisions.

A fake client stands in for Claude, so these tests never call the API or need a key.
"""

import io
import json
import zipfile
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import ai
from app.services.store import store

BASE = "/api/cases/CASE-001"


class FakeClaude:
    def __init__(self, payload, stop_reason="end_turn"):
        self.payload, self.stop_reason, self.calls = payload, stop_reason, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            stop_reason=self.stop_reason,
            model="claude-sonnet-5-5",
            content=[SimpleNamespace(type="text", text=json.dumps(self.payload))],
        )


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("GP_STORAGE_DIR", str(tmp_path))
    store.reset()
    return TestClient(app)


def use_fake(monkeypatch, payload, **kw):
    fake = FakeClaude(payload, **kw)
    monkeypatch.setattr(ai, "client_factory", lambda: fake)
    return fake


def docx(*paragraphs: str) -> bytes:
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", f"<w:document><w:body>{body}</w:body></w:document>")
    return buf.getvalue()


STATEMENT = docx(
    "I got to the bay at about ten past nine.",
    "The scanner on the door showed red, so I signed the paper sheet instead.",
)


def upload_statement(client):
    res = client.post(f"{BASE}/evidence", files={"file": ("statement.docx", STATEMENT)})
    assert res.status_code == 201
    return res.json()["id"]


def test_without_a_key_ai_says_it_is_off(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert client.get("/api/ai/status").json() == {
        "configured": False,
        "model": "claude-sonnet-5-5",
    }
    res = client.post(f"{BASE}/briefing", json={})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "ai_not_configured"


def test_requests_use_sonnet_structured_output_and_server_fallback(client, monkeypatch):
    fake = use_fake(monkeypatch, {"can_answer": True, "answer": "At 21:12.", "cites": ["EV-012"]})
    client.post(f"{BASE}/ask", json={"question": "When did the bay door open?"})
    call = fake.calls[0]
    assert call["model"] == "claude-sonnet-5-5"
    assert call["fallbacks"] == "default"
    assert call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert "never" in call["system"].lower()
    sent = call["messages"][0]["content"][0]["text"]
    assert "EV-012" in sent and "RULE-DUP-001" in sent


def test_suggestions_check_quotes_against_the_document(client, monkeypatch):
    evidence_id = upload_statement(client)
    use_fake(
        monkeypatch,
        {
            "events": [
                {
                    "locator": "para 1",
                    "quote": "I got to the bay at about ten past nine.",
                    "description": "Worker arrives at the bay",
                    "proposed_time": "2026-10-10T21:10:00+01:00",
                    "approximate_seconds": 300,
                    "date_assumed": True,
                },
                {
                    "locator": "para 3",
                    "quote": "Nobody else was there.",
                    "description": "Bay was empty",
                    "proposed_time": "",
                    "approximate_seconds": 0,
                    "date_assumed": False,
                },
            ]
        },
    )
    res = client.post(f"{BASE}/evidence/{evidence_id}/suggestions", json={"actor": "Femi"})
    assert res.status_code == 201
    first, second = res.json()
    assert first["quote_verified"] is True and first["status"] == "pending"
    assert second["quote_verified"] is False and second["proposed_time"] is None
    journey = client.get(f"{BASE}/journey").json()
    assert "2 AI suggestions to review" in journey["steps"][2]["detail"]


def test_accepting_puts_the_event_on_the_timeline_under_the_persons_name(client, monkeypatch):
    evidence_id = upload_statement(client)
    use_fake(
        monkeypatch,
        {
            "events": [
                {
                    "locator": "para 1",
                    "quote": "I got to the bay at about ten past nine.",
                    "description": "Worker arrives at the bay",
                    "proposed_time": "2026-10-10T21:10:00+01:00",
                    "approximate_seconds": 300,
                    "date_assumed": True,
                }
            ]
        },
    )
    sid = client.post(f"{BASE}/evidence/{evidence_id}/suggestions", json={}).json()[0]["id"]
    res = client.post(
        f"{BASE}/suggestions/{sid}", json={"action": "accept", "actor": "Judge Adaeze"}
    )
    assert res.status_code == 200
    body = res.json()
    event_id = body["suggestion"]["event_id"]
    assert body["change"]["added_events"] == [event_id]
    event = next(e for e in client.get(f"{BASE}/timeline").json() if e["id"] == event_id)
    assert event["extracted_by"] == "Judge Adaeze"
    assert event["state"] == "unresolved"  # the statement hedges: "about"
    assert "AI-suggested, accepted by Judge Adaeze" in event["normalization_rule"]
    assert "date taken from the case window" in event["normalization_rule"]
    again = client.post(f"{BASE}/suggestions/{sid}", json={"action": "reject"})
    assert again.status_code == 409


def test_a_suggestion_without_a_time_needs_one_and_can_be_rejected(client, monkeypatch):
    evidence_id = upload_statement(client)
    use_fake(
        monkeypatch,
        {
            "events": [
                {
                    "locator": "para 2",
                    "quote": "The scanner on the door showed red",
                    "description": "Scanner shows red",
                    "proposed_time": "",
                    "approximate_seconds": 0,
                    "date_assumed": False,
                }
            ]
        },
    )
    sid = client.post(f"{BASE}/evidence/{evidence_id}/suggestions", json={}).json()[0]["id"]
    assert (
        client.post(f"{BASE}/suggestions/{sid}", json={"action": "accept"}).json()["error"]["code"]
        == "time_needed"
    )
    res = client.post(
        f"{BASE}/suggestions/{sid}",
        json={"action": "reject", "reason": "No time stated", "actor": "Femi"},
    )
    assert res.json()["suggestion"]["status"] == "rejected"
    assert client.get(f"{BASE}/audit").json()[0]["action"] == "AI suggestion rejected"


def test_photos_the_ai_cannot_read_are_refused_clearly(client, monkeypatch):
    heic = b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00"
    evidence_id = client.post(f"{BASE}/evidence", files={"file": ("IMG.HEIC", heic)}).json()["id"]
    use_fake(monkeypatch, {"events": []})
    res = client.post(f"{BASE}/evidence/{evidence_id}/suggestions", json={})
    assert res.status_code == 415 and res.json()["error"]["code"] == "image_type_not_readable"


def test_briefing_drops_points_without_real_citations(client, monkeypatch):
    use_fake(
        monkeypatch,
        {
            "summary": [
                {"text": "The bay door opened at 21:12.", "cites": ["EV-012"]},
                {"text": "A guard saw everything.", "cites": ["E-42"]},
                {"text": "Uncited claim.", "cites": []},
            ],
            "key_facts": [{"text": "Camera runs 120 s fast.", "cites": ["C-02"]}],
            "open_questions": [{"text": "Who is on camera?", "cites": ["CL-04"]}],
            "next_steps": ["Get the gate camera export", " "],
        },
    )
    res = client.post(f"{BASE}/briefing", json={"actor": "Femi"})
    assert res.status_code == 201
    b = res.json()
    assert [p["cites"] for p in b["summary"]] == [["EV-012"]]
    assert b["removed"] == 2 and b["next_steps"] == ["Get the gate camera export"]
    assert client.get(f"{BASE}/briefing").json()["id"] == b["id"]


def test_ask_removes_invented_citations(client, monkeypatch):
    use_fake(monkeypatch, {"can_answer": True, "answer": "Badge B-117.", "cites": ["CL-99"]})
    res = client.post(f"{BASE}/ask", json={"question": "Who took the asset?"}).json()
    assert res["can_answer"] is False and res["cites"] == [] and res["removed"] == 1


def test_a_refusal_is_reported_not_hidden(client, monkeypatch):
    use_fake(monkeypatch, {}, stop_reason="refusal")
    res = client.post(f"{BASE}/ask", json={"question": "Anything?"})
    assert res.status_code == 422 and res.json()["error"]["code"] == "ai_declined"


def test_drafts_are_for_existing_questions_and_keep_only_real_citations(client, monkeypatch):
    use_fake(
        monkeypatch,
        {
            "finding": "not_established",
            "text": "The object is obscured.",
            "cites": ["CL-06", "X-1"],
        },
    )
    assert client.post(f"{BASE}/conclusion-draft", json={"question_id": "Q-09"}).status_code == 404
    draft = client.post(f"{BASE}/conclusion-draft", json={"question_id": "Q-03"}).json()
    assert draft["cites"] == ["CL-06"] and draft["removed"] == 1
