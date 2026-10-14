"""Tests for the investigation report export (issue: Report export).

Known answers come from docs/demo-scenario.md. The endpoint is exercised through the real API
(TestClient) so the tests cover the route, the builder and the Markdown renderer together.
"""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.store import store

ALL_CLAIMS = {"CL-01", "CL-02", "CL-03", "CL-04", "CL-05", "CL-06"}
ALL_EVIDENCE = {"E-01", "E-02", "E-03", "E-04", "E-05", "E-06"}


@pytest.fixture()
def client():
    store.reset()
    return TestClient(app)


def _json_report(client, case_id="CASE-001"):
    res = client.get(f"/api/cases/{case_id}/report?format=json")
    assert res.status_code == 200
    return json.loads(res.text)


def _section(report, section_id):
    return next(s for s in report["sections"] if s["id"] == section_id)


def test_markdown_lists_all_six_evidence_items(client):
    res = client.get("/api/cases/CASE-001/report?format=md")
    assert res.status_code == 200
    body = res.text
    for evidence_id in ALL_EVIDENCE:
        assert evidence_id in body
    assert "Evidence inventory" in body


def test_timeline_shows_source_and_normalized_side_by_side(client):
    body = client.get("/api/cases/CASE-001/report?format=md").text
    assert "21:16:00 → 21:14:00" in body  # EV-014 keeps both times, arrow between them


def test_conflicts_name_their_rules_and_evidence(client):
    report = _json_report(client)
    conflicts = _section(report, "conflicts")["items"]
    by_id = {c["id"]: c for c in conflicts}
    assert by_id["C-01"]["rule_id"] == "RULE-DUP-001"
    assert by_id["C-02"]["rule_id"] == "RULE-TIME-001"
    assert set(by_id["C-01"]["evidence"]) and set(by_id["C-02"]["evidence"])
    body = client.get("/api/cases/CASE-001/report?format=md").text
    assert "RULE-DUP-001" in body and "RULE-TIME-001" in body


def test_no_claim_is_dropped(client):
    """Contradicted and Unresolved claims appear, not only Supported ones."""
    report = _json_report(client)
    claims = _section(report, "claims")["items"]
    states = {c["id"]: c["state"] for c in claims}
    assert set(states) == ALL_CLAIMS
    assert states["CL-05"] == "contradicted"
    assert {states["CL-04"], states["CL-06"]} == {"unresolved"}
    assert "supported" in states.values() and "inferred" in states.values()


def test_unresolved_section_matches_unresolved_claims(client):
    report = _json_report(client)
    unresolved = _section(report, "unresolved")["items"]
    assert {c["id"] for c in unresolved} == {"CL-04", "CL-06"}


def test_two_calls_are_identical_apart_from_generated_at(client):
    first = _json_report(client)
    second = _json_report(client)
    assert first["generated_at"] and second["generated_at"]
    first.pop("generated_at")
    second.pop("generated_at")
    assert first == second

    def without_generated_line(text: str) -> str:
        return "\n".join(
            line for line in text.splitlines() if not line.startswith("_Generated ")
        )

    md_first = client.get("/api/cases/CASE-001/report?format=md").text
    md_second = client.get("/api/cases/CASE-001/report?format=md").text
    assert without_generated_line(md_first) == without_generated_line(md_second)


def test_report_has_notice_and_section_order(client):
    report = _json_report(client)
    assert report["notice"] == (
        "Investigative aid only. This report does not determine responsibility or guilt. "
        "All data is fictional."
    )
    assert [s["id"] for s in report["sections"]][:7] == [
        "scope",
        "evidence",
        "timeline",
        "conflicts",
        "hypotheses",
        "unresolved",
        "methods",
    ]
    methods = " ".join(_section(report, "methods")["points"])
    assert "extraction for video, audio and PDF is simulated in this demo" in methods


def test_scope_includes_incident_window(client):
    report = _json_report(client)
    facts = {f["label"]: f["value"] for f in _section(report, "scope")["facts"]}
    assert "21:00:00" in facts["Incident window"]
    assert "22:00:00" in facts["Incident window"]


def test_downloads_are_attachments_with_expected_types(client):
    md = client.get("/api/cases/CASE-001/report?format=md")
    assert "attachment" in md.headers["content-disposition"]
    assert "CASE-001-report.md" in md.headers["content-disposition"]
    assert md.headers["content-type"].startswith("text/markdown")

    js = client.get("/api/cases/CASE-001/report?format=json")
    assert "attachment" in js.headers["content-disposition"]
    assert "CASE-001-report.json" in js.headers["content-disposition"]
    assert js.headers["content-type"].startswith("application/json")


def test_unknown_case_returns_404_with_shared_shape(client):
    res = client.get("/api/cases/CASE-999/report?format=md")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "case_not_found"


def test_unsupported_format_returns_422_with_shared_shape(client):
    res = client.get("/api/cases/CASE-001/report?format=pdf")
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "unsupported_format"
    assert body["error"]["details"]["allowed"] == ["md", "json"]
