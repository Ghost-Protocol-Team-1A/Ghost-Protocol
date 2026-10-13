"""Deterministic conflict rules.

Each rule has a stable ID, says what it compared, and says what it cannot tell us. Rules flag
records for human review; they never conclude that anyone acted maliciously.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.models.domain import (
    Claim,
    ClaimState,
    ConflictType,
    Event,
    EvidenceItem,
    Severity,
)

DUPLICATE_KEYS = ("badge_id", "door", "event_code")


@dataclass(frozen=True)
class Finding:
    rule_id: str
    type: ConflictType
    severity: Severity
    evidence_ids: list[str]
    event_ids: list[str]
    explanation: str
    detection_method: str
    uncertain: str


def _hhmmss(ts: str | None) -> str:
    return ts[11:19] if ts else "unknown"


def rule_dup_001(
    evidence: list[EvidenceItem],
    events: list[Event],
    authoritative_for: dict[str, list[str]],
    **_: object,
) -> list[Finding]:
    """A log row repeated in another source with the same key fields but a different time."""
    findings: list[Finding] = []
    keyed = [e for e in events if all(e.record.get(k) for k in DUPLICATE_KEYS)]
    for i, a in enumerate(keyed):
        for b in keyed[i + 1 :]:
            if a.evidence_id == b.evidence_id:
                continue
            if any(a.record[k] != b.record[k] for k in DUPLICATE_KEYS):
                continue
            if a.normalized_time == b.normalized_time:
                continue
            code = a.record["event_code"]
            original, copy = (a, b) if code in authoritative_for.get(a.evidence_id, []) else (b, a)
            first_entry = min(
                (e for e in events if e.description.lower().startswith("person enters")),
                key=lambda e: e.normalized_time or "",
                default=None,
            )
            sequence_note = ""
            if (
                first_entry
                and copy.normalized_time
                and first_entry.normalized_time
                and copy.normalized_time < first_entry.normalized_time
            ):
                sequence_note = (
                    f" — before the first person enters at {_hhmmss(first_entry.source_time)}"
                    f" ({first_entry.evidence_id})"
                )
            findings.append(
                Finding(
                    rule_id="RULE-DUP-001",
                    type=ConflictType.COPIED_RECORD,
                    severity=Severity.HIGH,
                    evidence_ids=[original.evidence_id, copy.evidence_id],
                    event_ids=[original.id, copy.id],
                    explanation=(
                        f"{copy.evidence_id} {copy.locator} matches {original.evidence_id} "
                        f"{original.locator} on badge, door and event code but is stamped "
                        f"{_hhmmss(copy.source_time)} instead of {_hhmmss(original.source_time)}"
                        f"{sequence_note}. Possible copy or import error; not proof of tampering."
                    ),
                    detection_method="exact match on badge_id, door, event_code across sources",
                    uncertain=(
                        "Whether the copy was produced by an import job, a manual edit, or a "
                        "genuine second event."
                    ),
                )
            )
    return findings


def rule_time_001(evidence: list[EvidenceItem], events: list[Event], **_: object) -> list[Finding]:
    """A source whose clock differs from the reference clock."""
    findings: list[Finding] = []
    for item in evidence:
        offset = item.clock.offset_seconds
        if not offset:
            continue
        affected = [e for e in events if e.evidence_id == item.id]
        example = ""
        if affected:
            e = affected[0]
            example = (
                f" {e.id}: source {_hhmmss(e.source_time)} is normalized by {-offset:+d} s."
            )
        direction = "fast" if offset > 0 else "slow"
        findings.append(
            Finding(
                rule_id="RULE-TIME-001",
                type=ConflictType.CLOCK_OFFSET,
                severity=Severity.MEDIUM,
                evidence_ids=[item.id],
                event_ids=[e.id for e in affected],
                explanation=(
                    f"{item.id} ({item.source_name}) clock runs {abs(offset)} s {direction} "
                    f"against the reference clock.{example} Original times are preserved."
                ),
                detection_method=item.clock.method,
                uncertain=(
                    "In this demo the offset is declared in the fixture metadata, not inferred "
                    "from the evidence."
                    if item.clock.method == "declared_in_fixture_metadata"
                    else "Whether the offset was constant over the whole recording."
                ),
            )
        )
    return findings


def rule_claim_001(claims: list[Claim], **_: object) -> list[Finding]:
    """An identity claim that no source supports."""
    findings: list[Finding] = []
    for claim in claims:
        if claim.kind != "identity":
            continue
        if any(link.relationship == "supports" for link in claim.links):
            continue
        findings.append(
            Finding(
                rule_id="RULE-CLAIM-001",
                type=ConflictType.IDENTITY_NOT_ESTABLISHED,
                severity=Severity.REVIEW,
                evidence_ids=[],
                event_ids=[],
                explanation=f'No source supports "{claim.statement}" ({claim.id}).',
                detection_method="identity claim without a supporting evidence link",
                uncertain="Who the person is. Appearance on camera does not establish identity.",
            )
        )
    return findings


RULES: list[Callable[..., list[Finding]]] = [rule_dup_001, rule_time_001, rule_claim_001]


def apply_findings_to_events(events: list[Event], findings: list[Finding]) -> None:
    """Mark the copy in a copied-record finding as contradicted."""
    by_id = {e.id: e for e in events}
    for f in findings:
        if f.type is ConflictType.COPIED_RECORD:
            by_id[f.event_ids[1]].state = ClaimState.CONTRADICTED
