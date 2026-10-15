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
    ChangeSummary,
    Claim,
    ClaimState,
    Conflict,
    Event,
    EvidenceItem,
    Hypothesis,
    ReviewCreate,
    ReviewNote,
    ReviewStatus,
    StagedItem,
)
from app.services.ingest import load_seed, load_staged, staged_ids
from app.services.rules import RULES, apply_findings_to_events

SEEDS = ("case_001",)


class CaseData:
    def __init__(self, seed_name: str) -> None:
        seed = load_seed(seed_name)
        self.seed_name = seed_name
        self.case: Case = seed.case
        self.evidence: list[EvidenceItem] = seed.evidence
        self.claims: list[Claim] = seed.claims
        self.hypotheses: list[Hypothesis] = seed.hypotheses
        self.audit: list[AuditEvent] = seed.audit
        self.files = seed.files
        self.authoritative_for = seed.authoritative_for
        self.changes: list[ChangeSummary] = []
        self.conflict_reviews: dict[str, list[ReviewNote]] = {}
        self.events: list[Event] = []
        self.conflicts: list[Conflict] = []
        self._analyze(seed.events)

    @classmethod
    def blank(cls, case: Case, created_at: str) -> CaseData:
        """An empty case created by an investigator; evidence is added later."""
        data = cls.__new__(cls)
        data.seed_name = ""
        data.case = case
        data.evidence, data.claims, data.hypotheses = [], [], []
        data.files, data.authoritative_for, data.changes = {}, {}, []
        data.conflict_reviews = {}
        data.events, data.conflicts = [], []
        data.audit = [
            AuditEvent(
                id="A-001",
                case_id=case.id,
                at=created_at,
                actor="BJ",
                action="Case created",
                entity_ref=case.id,
                details=case.title,
            )
        ]
        return data

    def _analyze(self, events: list[Event]) -> None:
        """Run every rule over the current evidence. Deterministic for the same inputs."""
        findings = [
            f
            for rule in RULES
            for f in rule(
                evidence=self.evidence,
                events=events,
                claims=self.claims,
                authoritative_for=self.authoritative_for,
            )
        ]
        apply_findings_to_events(events, findings)
        self.events = sorted(events, key=lambda e: (e.normalized_time or "9999", e.id))
        self.conflicts = [
            Conflict(id=f"C-{i:02d}", case_id=self.case.id, **f.__dict__)
            for i, f in enumerate(findings, 1)
        ]
        # Human decisions survive re-analysis: re-attach them by what the rule found.
        for c in self.conflicts:
            c.reviews = list(self.conflict_reviews.get(self._conflict_key(c), []))
            decided = [r.status for r in c.reviews if r.status is not None]
            if decided:
                c.status = decided[-1]

    @staticmethod
    def _conflict_key(c: Conflict) -> str:
        ids = ",".join(c.evidence_ids + c.event_ids)
        return f"{c.rule_id}|{ids or c.explanation}"

    def review(self, body: ReviewCreate, at: str) -> Conflict | Hypothesis:
        """Record a reviewer decision. Raises LookupError or ValueError on bad input."""
        note = ReviewNote(actor=body.actor, at=at, note=body.note.strip(), status=body.status)
        if body.target_id.startswith("C-"):
            conflict = next((c for c in self.conflicts if c.id == body.target_id), None)
            if conflict is None:
                raise LookupError(body.target_id)
            self.conflict_reviews.setdefault(self._conflict_key(conflict), []).append(note)
            conflict.reviews.append(note)
            if body.status is not None:
                conflict.status = body.status
            return conflict
        hypothesis = next((h for h in self.hypotheses if h.id == body.target_id), None)
        if hypothesis is None:
            raise LookupError(body.target_id)
        if body.status is not None:
            raise ValueError("Hypotheses take notes only; their state comes from the evidence.")
        hypothesis.reviews.append(note)
        return hypothesis

    def staged(self) -> list[StagedItem]:
        present = {e.id for e in self.evidence}
        items = []
        if not self.seed_name:
            return items
        for evidence_id in staged_ids(self.seed_name):
            if evidence_id in present:
                continue
            s = load_staged(self.seed_name, evidence_id, self.case.id, "")
            items.append(
                StagedItem(
                    evidence_id=evidence_id, source_name=s.evidence.source_name, summary=s.summary
                )
            )
        return items

    def add_staged(self, evidence_id: str, at: str) -> ChangeSummary:
        """Add held-back evidence, re-run the analysis, and record what changed."""
        staged = load_staged(self.seed_name, evidence_id, self.case.id, at)
        before_conflicts = {c.id: c.explanation for c in self.conflicts}
        before_events = {e.id: e.state for e in self.events}
        before_claims = {c.id: c.state for c in self.claims}

        self.evidence.append(staged.evidence)
        self.claims.extend(staged.claims)
        for h in self.hypotheses:
            note = staged.hypothesis_notes.get(h.id)
            if note:
                h.notes = f"{h.notes} {note}"
        self._analyze(self.events + staged.events)

        after_conflicts = {c.id: c.explanation for c in self.conflicts}
        changes = [
            f"{e.id}: {before_events[e.id].value} → {e.state.value}"
            for e in self.events
            if e.id in before_events and before_events[e.id] is not e.state
        ] + [
            f"{c.id}: {before_claims[c.id].value} → {c.state.value}"
            for c in self.claims
            if c.id in before_claims and before_claims[c.id] is not c.state
        ]
        unchanged = [
            f"{c.id} still {c.state.value}: {c.statement}"
            for c in self.claims
            if c.id in before_claims
            and before_claims[c.id] is c.state
            and c.state is ClaimState.UNRESOLVED
        ]
        same_conflicts = [
            cid for cid, text in before_conflicts.items() if after_conflicts.get(cid) == text
        ]
        if same_conflicts:
            unchanged.append(f"Conflicts unchanged: {', '.join(same_conflicts)}")

        summary = ChangeSummary(
            id=f"CH-{len(self.changes) + 1:02d}",
            case_id=self.case.id,
            at=at,
            trigger=f"Added {staged.evidence.id} · {staged.evidence.source_name}",
            added_evidence=[staged.evidence.id],
            added_events=[e.id for e in staged.events],
            added_claims=[c.id for c in staged.claims],
            conflicts_added=sorted(set(after_conflicts) - set(before_conflicts)),
            conflicts_removed=sorted(set(before_conflicts) - set(after_conflicts)),
            state_changes=changes,
            unchanged=unchanged,
        )
        self.changes.append(summary)
        return summary

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

    def create_case(self, title: str, description: str, start: str, end: str) -> CaseData:
        number = max(int(cid.split("-")[1]) for cid in self.cases) + 1 if self.cases else 1
        case = Case(
            id=f"CASE-{number:03d}",
            title=title,
            description=description,
            incident_start=start,
            incident_end=end,
            status="open",
            fictional=False,
        )
        data = CaseData.blank(case, self.now())
        self.cases[case.id] = data
        return data

    @staticmethod
    def now() -> str:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")

    def record(self, case_id: str, actor: str, action: str, entity_ref: str, details: str) -> None:
        data = self.cases[case_id]
        data.audit.append(
            AuditEvent(
                id=f"A-{len(data.audit) + 1:03d}",
                case_id=case_id,
                at=self.now(),
                actor=actor,
                action=action,
                entity_ref=entity_ref,
                details=details,
            )
        )


store = Store()
