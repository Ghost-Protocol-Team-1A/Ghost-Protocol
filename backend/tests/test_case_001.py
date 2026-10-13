"""Known-answer tests for CASE-001. Expected values come from docs/demo-scenario.md."""

from app.models.domain import ClaimState
from app.services.store import CaseData


def case():
    return CaseData("case_001")


def by_id(items):
    return {i.id: i for i in items}


def test_six_evidence_items_and_real_hashes_for_logs():
    data = case()
    assert [e.id for e in data.evidence] == ["E-01", "E-02", "E-03", "E-04", "E-05", "E-06"]
    hashed = {e.id for e in data.evidence if e.sha256}
    assert hashed == {"E-04", "E-05"}
    assert all(e.simulated for e in data.evidence if e.id not in hashed)


def test_camera_offset_keeps_source_time():
    ev = by_id(case().events)["EV-014"]
    assert ev.source_time == "2026-10-10T21:16:00+01:00"
    assert ev.normalized_time == "2026-10-10T20:14:00Z"  # 21:14 local
    assert ev.offset_seconds == 120


def test_copied_log_conflict_links_both_rows():
    c01 = by_id(case().conflicts)["C-01"]
    assert c01.rule_id == "RULE-DUP-001"
    assert c01.evidence_ids == ["E-04", "E-05"]
    assert c01.event_ids == ["EV-012", "EV-009"]
    assert "not proof of tampering" in c01.explanation


def test_clock_offset_conflict_names_e02():
    c02 = by_id(case().conflicts)["C-02"]
    assert c02.rule_id == "RULE-TIME-001"
    assert c02.evidence_ids == ["E-02"]
    assert "declared in the fixture" in c02.uncertain


def test_event_states():
    events = by_id(case().events)
    assert events["EV-009"].state is ClaimState.CONTRADICTED
    assert events["EV-012"].state is ClaimState.SUPPORTED
    assert events["EV-016"].state is ClaimState.INFERRED
    assert events["EV-018"].state is ClaimState.UNRESOLVED


def test_no_event_names_a_person():
    for e in case().events:
        assert "suspect" not in e.description.lower()
        assert "thief" not in e.description.lower()


def test_non_unresolved_claims_cite_evidence():
    for claim in case().claims:
        if claim.state is not ClaimState.UNRESOLVED:
            assert claim.links, claim.id


def test_analysis_is_deterministic():
    a, b = case(), case()
    assert [e.model_dump() for e in a.events] == [e.model_dump() for e in b.events]
    assert [c.model_dump() for c in a.conflicts] == [c.model_dump() for c in b.conflicts]
