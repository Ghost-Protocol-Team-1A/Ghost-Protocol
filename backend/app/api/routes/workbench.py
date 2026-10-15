"""Investigator actions that turn evidence into events: observations and clock settings.

Each action adds or re-times events, re-runs every rule, and returns what changed. Nothing is
inferred about meaning: an observation is recorded under the name of the person who made it.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.routes.cases import get_case
from app.errors import ApiError, not_found
from app.models.domain import (
    ChangeSummary,
    ClaimState,
    ClockAssumption,
    ClockUpdate,
    Event,
    EvidenceItem,
    EvidenceType,
    ExtractionMethod,
    ObservationCreate,
    ProcessingStatus,
)
from app.services.ingest import apply_inferred_offset
from app.services.normalize import normalize
from app.services.offsets import INFER_METHOD, REFERENCE_METHOD
from app.services.store import CaseData, clock_suffix, store

router = APIRouter(prefix="/api", tags=["workbench"])

_OBSERVABLE = {EvidenceType.VIDEO, EvidenceType.AUDIO}


class ObservationResult(BaseModel):
    event: Event
    change: ChangeSummary


def _item(data: CaseData, evidence_id: str) -> EvidenceItem:
    item = data.item(evidence_id)
    if item is None:
        raise not_found("evidence", evidence_id)
    return item


def timecode_seconds(timecode: str) -> int:
    parts = [int(p) for p in timecode.split(":")]
    seconds = 0
    for p in parts:
        seconds = seconds * 60 + p
    return seconds


@router.post(
    "/cases/{case_id}/evidence/{evidence_id}/observations",
    response_model=ObservationResult,
    status_code=201,
)
def add_observation(case_id: str, evidence_id: str, body: ObservationCreate) -> ObservationResult:
    """Log what a person saw or heard at a timecode in a recording."""
    data = get_case(case_id)
    item = _item(data, evidence_id)
    if item.type not in _OBSERVABLE:
        raise ApiError(
            422,
            "not_a_recording",
            f"{evidence_id} is {item.type.value}; observations are logged on audio or video.",
        )
    offset = timedelta(seconds=timecode_seconds(body.timecode))
    if body.source_time is not None:
        source_time = body.source_time.isoformat()
    elif item.recorded_at:
        start = datetime.fromisoformat(item.recorded_at.replace("Z", "+00:00"))
        source_time = (start + offset).isoformat()
    else:
        raise ApiError(
            422,
            "source_time_needed",
            f"{item.original_filename} holds no start time. Give the time this moment shows.",
        )
    n = normalize(source_time, item.clock.offset_seconds)
    event = Event(
        id=data.next_event_id(item.id, "O"),
        case_id=case_id,
        evidence_id=item.id,
        locator=f"timecode {body.timecode}",
        description=body.description.strip(),
        source_time=source_time,
        normalized_time=n.normalized_time,
        offset_seconds=n.offset_seconds,
        normalization_rule=f"{n.rule}{clock_suffix(item)}",
        state=ClaimState.INFERRED if body.interpretation else ClaimState.SUPPORTED,
        extracted_by=body.actor,
    )
    item.processing_status = ProcessingStatus.EXTRACTED
    if item.extraction_method is ExtractionMethod.NONE:
        item.extraction_method = ExtractionMethod.MANUAL
    count = sum(1 for e in data.events if e.evidence_id == item.id) + 1
    item.extraction_note = f"{count} observation{'s' if count != 1 else ''} logged by investigators"
    change = data.add_events(
        item, [event], store.now(), f"Observation on {item.id} at {body.timecode} · {body.actor}"
    )
    store.record(case_id, body.actor, "Observation logged", event.id, event.description)
    return ObservationResult(event=event, change=change)


@router.put("/cases/{case_id}/evidence/{evidence_id}/clock", response_model=ChangeSummary)
def set_clock(case_id: str, evidence_id: str, body: ClockUpdate) -> ChangeSummary:
    """Set how a source's clock relates to the reference clock, then re-time its events."""
    data = get_case(case_id)
    item = _item(data, evidence_id)
    before = data._snapshot()
    note = body.note.strip()

    if body.method == "reference_clock":
        item.clock = ClockAssumption(offset_seconds=0, method=REFERENCE_METHOD, note=note)
        summary = "on the reference clock"
    elif body.method == "declared":
        item.clock = ClockAssumption(
            offset_seconds=body.offset_seconds, method="declared_by_investigator", note=note
        )
        direction = "fast" if body.offset_seconds > 0 else "slow"
        summary = f"declared {abs(body.offset_seconds)} s {direction}"
    else:
        _check_anchors(data, item, body.anchors)
        item.clock = ClockAssumption(method=INFER_METHOD, anchors=body.anchors, note=note)
        apply_inferred_offset(item, data.events, data.evidence)
        if item.clock.method == INFER_METHOD:  # no usable anchor
            raise ApiError(422, "no_usable_anchor", item.clock.note)
        off = item.clock.offset_seconds
        summary = f"inferred {abs(off)} s {'fast' if off >= 0 else 'slow'}. {item.clock.note}"

    data.renormalize(item)
    change = data._change(before, store.now(), f"Clock set for {item.id}: {summary}", [], [], [])
    store.record(case_id, body.actor, "Clock set", item.id, summary)
    return change


def _check_anchors(data: CaseData, item: EvidenceItem, anchors: dict[str, str]) -> None:
    if not anchors:
        raise ApiError(422, "anchors_needed", "Pair at least one moment with a trusted source.")
    by_id = {e.id: e for e in data.events}
    trusted = {e.id for e in data.evidence if e.clock.method == REFERENCE_METHOD}
    for own, ref in anchors.items():
        if own not in by_id or by_id[own].evidence_id != item.id:
            raise ApiError(422, "bad_anchor", f"{own} is not an event of {item.id}.")
        if ref not in by_id or by_id[ref].evidence_id not in trusted:
            raise ApiError(
                422, "bad_anchor", f"{ref} must be an event from a source on the reference clock."
            )
