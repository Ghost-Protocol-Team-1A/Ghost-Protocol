"""In-memory case store for the demo.

Analysis is recomputed from the seed on every reset, so the demo always returns to the same
state. A database-backed store can replace this behind the same methods.
"""

from __future__ import annotations

import csv
from datetime import UTC, datetime

from app.models.domain import (
    AuditEvent,
    Case,
    CaseSummary,
    Claim,
    Conflict,
    Event,
    EvidenceItem,
    Hypothesis,
    ReviewStatus,
)
from app.services.ingest import load_seed
from app.services.rules import RULES, apply_findings_to_events

SEEDS = ("case_001",)


class CaseData:
    def __init__(self, seed_name: str) -> None:
        seed = load_seed(seed_name)
        self.case: Case = seed.case
        self.evidence: list[EvidenceItem] = seed.evidence
        self.claims: list[Claim] = seed.claims
        self.hypotheses: list[Hypothesis] = seed.hypotheses
        self.audit: list[AuditEvent] = seed.audit
        self.files = seed.files
        events = seed.events
        findings = [
            f
            for rule in RULES
            for f in rule(
                evidence=seed.evidence,
                events=events,
                claims=seed.claims,
                authoritative_for=seed.authoritative_for,
            )
        ]
        apply_findings_to_events(events, findings)
        self.events: list[Event] = sorted(
            events, key=lambda e: (e.normalized_time or "9999", e.id)
        )
        self.conflicts: list[Conflict] = [
            Conflict(id=f"C-{i:02d}", case_id=self.case.id, **f.__dict__)
            for i, f in enumerate(findings, 1)
        ]

    def original_rows(self, evidence_id: str) -> tuple[str, list[str], list[dict[str, str]]] | None:
        """Read-only view of an original log file: (filename, columns, rows)."""
        path = self.files.get(evidence_id)
        if path is None:
            return None
        with path.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            rows = list(reader)
            return path.name, list(reader.fieldnames or []), rows

    def summary(self) -> CaseSummary:
        return CaseSummary(
            case=self.case,
            evidence_count=len(self.evidence),
            event_count=len(self.events),
            open_conflicts=sum(c.status is ReviewStatus.OPEN for c in self.conflicts),
        )


class Store:
    def __init__(self) -> None:
        self.cases: dict[str, CaseData] = {}
        self.reset()

    def reset(self) -> None:
        self.cases = {}
        for name in SEEDS:
            data = CaseData(name)
            self.cases[data.case.id] = data

    def record(self, case_id: str, actor: str, action: str, entity_ref: str, details: str) -> None:
        data = self.cases[case_id]
        data.audit.append(
            AuditEvent(
                id=f"A-{len(data.audit) + 1:03d}",
                case_id=case_id,
                at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                actor=actor,
                action=action,
                entity_ref=entity_ref,
                details=details,
            )
        )


store = Store()
