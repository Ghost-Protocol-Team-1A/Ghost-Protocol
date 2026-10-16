"""AI assistance routes: suggestions from documents, briefings, questions and drafts.

Each response says which model produced it, and each use is written to the audit trail under
the name of the person who asked.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.routes.cases import get_case
from app.api.routes.evidence_upload import original_path
from app.errors import ApiError, not_found
from app.models.domain import (
    AiRequest,
    AiStatus,
    AskAnswer,
    AskRequest,
    Briefing,
    ChangeSummary,
    CitedPoint,
    ClaimState,
    Draft,
    DraftRequest,
    Event,
    ExtractionMethod,
    ProcessingStatus,
    Suggestion,
    SuggestionDecision,
)
from app.services import ai
from app.services.normalize import normalize
from app.services.store import clock_suffix, store

router = APIRouter(prefix="/api", tags=["ai"])


class DecisionResult(BaseModel):
    suggestion: Suggestion
    change: ChangeSummary | None = None


@router.get("/ai/status", response_model=AiStatus)
def ai_status() -> AiStatus:
    return AiStatus(configured=ai.configured(), model=ai.MODEL)


@router.get("/cases/{case_id}/suggestions", response_model=list[Suggestion])
def list_suggestions(case_id: str) -> list[Suggestion]:
    return get_case(case_id).suggestions


@router.post(
    "/cases/{case_id}/evidence/{evidence_id}/suggestions",
    response_model=list[Suggestion],
    status_code=201,
)
def suggest(case_id: str, evidence_id: str, body: AiRequest) -> list[Suggestion]:
    """Have the AI read one document and propose the events it states."""
    data = get_case(case_id)
    item = data.item(evidence_id)
    if item is None:
        raise not_found("evidence", evidence_id)
    path = original_path(data, item)
    if path is None:
        raise ApiError(404, "original_not_available", f"No stored file for {evidence_id}.")
    events, text, model = ai.suggest_events(data, item, path)
    now = store.now()
    start = len(data.suggestions)
    created = []
    for i, e in enumerate(events, 1):
        time = (e.get("proposed_time") or "").strip() or None
        if time:
            try:
                time = datetime.fromisoformat(time.replace("Z", "+00:00")).isoformat()
            except ValueError:
                time = None
        created.append(
            Suggestion(
                id=f"S-{start + i:02d}",
                case_id=case_id,
                evidence_id=item.id,
                locator=(e.get("locator") or "document")[:80],
                quote=(e.get("quote") or "")[:600],
                description=(e.get("description") or "")[:300],
                proposed_time=time,
                approximate_seconds=max(0, min(int(e.get("approximate_seconds") or 0), 86_400)),
                date_assumed=bool(e.get("date_assumed")),
                quote_verified=None if text is None else ai.quote_found(e.get("quote", ""), text),
                model=model,
                created_at=now,
            )
        )
    data.suggestions.extend(created)
    item.extraction_note = f"{len(created)} AI suggestions waiting for review"
    store.record(
        case_id, body.actor, "AI read evidence", item.id, f"{len(created)} suggestions · {model}"
    )
    return created


@router.post("/cases/{case_id}/suggestions/{suggestion_id}", response_model=DecisionResult)
def decide(case_id: str, suggestion_id: str, body: SuggestionDecision) -> DecisionResult:
    """Accept a suggestion (optionally edited) into the timeline, or reject it with a reason."""
    data = get_case(case_id)
    s = next((x for x in data.suggestions if x.id == suggestion_id), None)
    if s is None:
        raise not_found("suggestion", suggestion_id)
    if s.status != "pending":
        raise ApiError(409, "already_decided", f"{s.id} was already {s.status} by {s.decided_by}.")
    s.decided_by, s.decided_at = body.actor, store.now()
    if body.action == "reject":
        s.status, s.reason = "rejected", body.reason.strip()
        store.record(case_id, body.actor, "AI suggestion rejected", s.id, s.reason or s.description)
        return DecisionResult(suggestion=s)

    item = data.item(s.evidence_id)
    time = body.proposed_time.isoformat() if body.proposed_time else s.proposed_time
    if item is None or time is None:
        s.status, s.decided_by, s.decided_at = "pending", None, None
        raise ApiError(422, "time_needed", "Give the time this event happened before accepting it.")
    n = normalize(time, item.clock.offset_seconds, s.approximate_seconds)
    assumed = (
        "; date taken from the case window" if s.date_assumed and not body.proposed_time else ""
    )
    event = Event(
        id=data.next_event_id(item.id, "A"),
        case_id=case_id,
        evidence_id=item.id,
        locator=s.locator,
        description=(body.description or s.description).strip(),
        source_time=time,
        normalized_time=n.normalized_time,
        offset_seconds=n.offset_seconds,
        normalization_rule=(
            f"{n.rule}{clock_suffix(item)}{assumed}; AI-suggested, accepted by {body.actor}"
        ),
        approximate=bool(s.approximate_seconds),
        uncertainty_seconds=n.uncertainty_seconds,
        state=ClaimState.UNRESOLVED if s.approximate_seconds else ClaimState.SUPPORTED,
        record={"quote": s.quote},
        extracted_by=body.actor,
    )
    s.status, s.event_id = "accepted", event.id
    item.processing_status = ProcessingStatus.EXTRACTED
    item.extraction_method = ExtractionMethod.AI_ACCEPTED
    pending = sum(1 for x in data.suggestions if x.evidence_id == item.id and x.status == "pending")
    accepted = sum(
        1 for x in data.suggestions if x.evidence_id == item.id and x.status == "accepted"
    )
    item.extraction_note = f"{accepted} AI suggestions accepted" + (
        f", {pending} pending" if pending else ""
    )
    change = data.add_events(
        item, [event], store.now(), f"Accepted {s.id} from {item.id} · {body.actor}"
    )
    store.record(case_id, body.actor, "AI suggestion accepted", event.id, event.description)
    return DecisionResult(suggestion=s, change=change)


@router.post("/cases/{case_id}/briefing", response_model=Briefing, status_code=201)
def make_briefing(case_id: str, body: AiRequest) -> Briefing:
    data = get_case(case_id)
    out, removed, model = ai.briefing(data)
    result = Briefing(
        id=f"B-{len(data.briefings) + 1}",
        case_id=case_id,
        model=model,
        created_at=store.now(),
        created_by=body.actor,
        summary=[CitedPoint(**p) for p in out["summary"]],
        key_facts=[CitedPoint(**p) for p in out["key_facts"]],
        open_questions=[CitedPoint(**p) for p in out["open_questions"]],
        next_steps=out["next_steps"],
        removed=removed,
    )
    data.briefings.append(result)
    store.record(
        case_id,
        body.actor,
        "AI briefing compiled",
        result.id,
        f"{model} · {removed} uncited points removed",
    )
    return result


@router.get("/cases/{case_id}/briefing", response_model=Briefing)
def latest_briefing(case_id: str) -> Briefing:
    data = get_case(case_id)
    if not data.briefings:
        raise ApiError(404, "no_briefing", "No briefing has been compiled for this case yet.")
    return data.briefings[-1]


@router.post("/cases/{case_id}/ask", response_model=AskAnswer)
def ask_case(case_id: str, body: AskRequest) -> AskAnswer:
    data = get_case(case_id)
    out, removed, model = ai.ask(data, body.question.strip())
    store.record(case_id, body.actor, "Asked the case", case_id, body.question.strip()[:200])
    return AskAnswer(
        question=body.question.strip(), removed=removed, model=model, created_at=store.now(), **out
    )


@router.post("/cases/{case_id}/conclusion-draft", response_model=Draft)
def draft(case_id: str, body: DraftRequest) -> Draft:
    data = get_case(case_id)
    out, removed, model = ai.draft_answer(data, body.question_id)
    store.record(case_id, body.actor, "AI draft requested", body.question_id, model)
    return Draft(question_id=body.question_id, removed=removed, model=model, **out)
