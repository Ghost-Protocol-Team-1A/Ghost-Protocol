"""Questions, claims and the signed conclusion: where people reach a finding.

The rules here keep a finding tied to evidence. A claim's state must match its citations; an
answer marked established must rest on a supported claim; a conclusion is signed only when
every question has an answer and no conflict is still open. Signing never edits the past: a
new conclusion supersedes the previous one and both stay on record.
"""

from __future__ import annotations

from app.errors import ApiError
from app.models.domain import (
    Claim,
    ClaimCreate,
    ClaimState,
    Conclusion,
    ConclusionCreate,
    Finding,
    Journey,
    JourneyStep,
    ProcessingStatus,
    Question,
    QuestionCreate,
    ReviewStatus,
)
from app.services.store import CaseData


def _next_id(prefix: str, ids: list[str]) -> str:
    used = [int(i.split("-")[1]) for i in ids if i.startswith(prefix) and i.split("-")[1].isdigit()]
    return f"{prefix}{max(used, default=0) + 1:02d}"


def add_question(data: CaseData, body: QuestionCreate, at: str) -> Question:
    text = " ".join(body.text.split())
    if any(q.text.lower() == text.lower() for q in data.questions):
        raise ApiError(409, "duplicate_question", "This case already asks that question.")
    question = Question(
        id=_next_id("Q-", [q.id for q in data.questions]),
        case_id=data.case.id,
        text=text,
        created_by=body.actor,
        created_at=at,
    )
    data.questions.append(question)
    return question


def check_claim(data: CaseData, body: ClaimCreate) -> None:
    """A claim's state has to be what its citations can carry."""
    known = {e.id for e in data.evidence}
    for link in body.links:
        if link.evidence_id not in known:
            raise ApiError(422, "unknown_evidence", f"{link.evidence_id} is not in this case.")
    if body.question_id and body.question_id not in {q.id for q in data.questions}:
        raise ApiError(422, "unknown_question", f"{body.question_id} is not a question here.")
    supports = sum(1 for link in body.links if link.relationship == "supports")
    contradicts = sum(1 for link in body.links if link.relationship == "contradicts")
    needs = {
        ClaimState.SUPPORTED: (supports >= 1, "Supported needs at least one supporting citation."),
        ClaimState.CONTRADICTED: (
            contradicts >= 1,
            "Contradicted needs at least one contradicting citation.",
        ),
        ClaimState.INFERRED: (
            len(body.links) >= 2,
            "Inferred needs at least two citations that it follows from together.",
        ),
        ClaimState.UNRESOLVED: (True, ""),
    }
    ok, message = needs[body.state]
    if not ok:
        raise ApiError(422, "state_not_supported_by_citations", message)


def add_claim(data: CaseData, body: ClaimCreate) -> Claim:
    check_claim(data, body)
    claim = Claim(
        id=_next_id("CL-", [c.id for c in data.claims]),
        case_id=data.case.id,
        statement=" ".join(body.statement.split()),
        state=body.state,
        rationale=body.rationale.strip(),
        links=body.links,
        origin="investigator",
        question_id=body.question_id,
        created_by=body.actor,
    )
    data.claims.append(claim)
    return claim


def known_ids(data: CaseData) -> set[str]:
    return (
        {c.id for c in data.claims}
        | {e.id for e in data.evidence}
        | {e.id for e in data.events}
        | {c.id for c in data.conflicts}
        | {h.id for h in data.hypotheses}
    )


def sign_conclusion(data: CaseData, body: ConclusionCreate, at: str) -> Conclusion:
    if not data.questions:
        raise ApiError(422, "no_questions", "Add the questions this case must answer first.")
    if not (body.attest_sources_reviewed and body.attest_unresolved_stated):
        raise ApiError(422, "attestation_required", "Both statements must be confirmed to sign.")
    open_conflicts = [c.id for c in data.conflicts if c.status is ReviewStatus.OPEN]
    if open_conflicts:
        raise ApiError(
            422,
            "open_conflicts",
            f"Decide every conflict before signing: {', '.join(open_conflicts)} still open.",
            {"open": open_conflicts},
        )
    asked = [q.id for q in data.questions]
    answered = [a.question_id for a in body.answers]
    if sorted(answered) != sorted(asked):
        missing = sorted(set(asked) - set(answered))
        extra = sorted(set(answered) - set(asked))
        raise ApiError(
            422,
            "answers_must_match_questions",
            "Answer each question exactly once.",
            {"missing": missing, "unknown": extra},
        )
    ids = known_ids(data)
    claims = {c.id: c for c in data.claims}
    for answer in body.answers:
        unknown = [c for c in answer.cites if c not in ids]
        if unknown:
            raise ApiError(
                422, "unknown_citation", f"{answer.question_id} cites unknown {', '.join(unknown)}."
            )
        if answer.finding is Finding.ESTABLISHED and not any(
            claims[c].state is ClaimState.SUPPORTED for c in answer.cites if c in claims
        ):
            raise ApiError(
                422,
                "established_needs_support",
                f"{answer.question_id}: 'Established' must cite at least one supported claim.",
            )
    previous = data.conclusions[-1] if data.conclusions else None
    conclusion = Conclusion(
        id=f"CON-{len(data.conclusions) + 1}",
        case_id=data.case.id,
        version=len(data.conclusions) + 1,
        answers=body.answers,
        signed_by=body.actor,
        role=body.role,
        signed_at=at,
        supersedes=previous.id if previous else None,
    )
    data.conclusions.append(conclusion)
    return conclusion


def journey(data: CaseData) -> Journey:
    """Where a case stands, step by step, and the single next thing to do."""
    base = f"/cases/{data.case.id}"
    pending_ai = sum(1 for s in getattr(data, "suggestions", []) if s.status == "pending")
    not_extracted = [
        e.id for e in data.evidence if e.processing_status is not ProcessingStatus.EXTRACTED
    ]
    clocks_unset = [
        e.id
        for e in data.evidence
        if e.clock.method == "not_set" and any(ev.evidence_id == e.id for ev in data.events)
    ]
    open_conflicts = [c.id for c in data.conflicts if c.status is ReviewStatus.OPEN]
    unanswerable = [
        q.id for q in data.questions if not any(c.question_id == q.id for c in data.claims)
    ]
    signed = data.conclusions[-1] if data.conclusions else None

    def plural(n: int, word: str) -> str:
        return f"{n} {word}{'' if n == 1 else 's'}"

    steps = [
        JourneyStep(
            key="scope",
            label="Scope",
            done=bool(data.case.scope.strip()),
            detail="Scope and incident window set"
            if data.case.scope.strip()
            else "No scope written",
            href=base,
        ),
        JourneyStep(
            key="evidence",
            label="Evidence",
            done=bool(data.evidence),
            detail=plural(len(data.evidence), "file") + " checked and hashed"
            if data.evidence
            else "Upload the first file",
            href=f"{base}/intake",
        ),
        JourneyStep(
            key="extract",
            label="Extract",
            done=bool(data.evidence) and not not_extracted and not pending_ai,
            detail=(
                f"{plural(pending_ai, 'AI suggestion')} to review"
                if pending_ai
                else f"{plural(len(not_extracted), 'file')} without events yet"
                if not_extracted
                else plural(len(data.events), "event") + " on the timeline"
            ),
            href=f"{base}/extract",
        ),
        JourneyStep(
            key="timeline",
            label="Timeline",
            done=bool(data.events) and not clocks_unset and not open_conflicts,
            detail=(
                f"{plural(len(clocks_unset), 'clock')} not set"
                if clocks_unset
                else f"{plural(len(open_conflicts), 'conflict')} to decide"
                if open_conflicts
                else "Clocks set, every conflict decided"
            ),
            href=f"{base}/evidence?e={clocks_unset[0]}" if clocks_unset else f"{base}/conflicts",
        ),
        JourneyStep(
            key="questions",
            label="Questions",
            done=bool(data.questions) and not unanswerable,
            detail=(
                "Write what the case must establish"
                if not data.questions
                else f"{plural(len(unanswerable), 'question')} without a claim"
                if unanswerable
                else f"{plural(len(data.questions), 'question')}, each with claims"
            ),
            href=f"{base}/questions",
        ),
        JourneyStep(
            key="conclude",
            label="Conclude",
            done=signed is not None,
            detail=f"Signed by {signed.signed_by} (v{signed.version})" if signed else "Not signed",
            href=f"{base}/conclusion",
        ),
    ]
    current = next((s for s in steps if not s.done), steps[-1])
    labels = {
        "scope": "Write the case scope",
        "evidence": "Upload evidence",
        "extract": "Turn your evidence into events",
        "timeline": "Set clocks and decide conflicts",
        "questions": "Write the questions and claims",
        "conclude": "Answer each question and sign",
    }
    return Journey(
        case_id=data.case.id,
        steps=steps,
        current=current.key,
        next_label="Read the signed report" if signed and current.done else labels[current.key],
        next_detail=current.detail,
        next_href=f"{base}/report" if signed and current.done else current.href,
    )
