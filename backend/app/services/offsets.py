"""Clock offset inference.

A source whose clock is unknown can carry anchor events: moments it recorded that a
reference-clock source also recorded (a door opening seen on camera and in the access log).
Each anchor gives one offset estimate, source time minus reference time. The median of the
estimates becomes the source's offset; the spread between estimates is kept as uncertainty.

Inference never edits a source time. It only decides the offset that normalization applies.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from statistics import median

from app.models.domain import Event, EvidenceItem

INFER_METHOD = "infer_from_anchors"
INFERRED_METHOD = "inferred_from_anchors"
REFERENCE_METHOD = "reference_clock"


@dataclass(frozen=True)
class Anchor:
    event_id: str
    reference_event_id: str
    reference_evidence_id: str
    delta_seconds: int


@dataclass(frozen=True)
class OffsetEstimate:
    evidence_id: str
    offset_seconds: int
    spread_seconds: int
    anchors: list[Anchor]


def _seconds_between(source: str, reference: str) -> int:
    delta = datetime.fromisoformat(source) - datetime.fromisoformat(reference)
    return round(delta.total_seconds())


def infer_offset(
    item: EvidenceItem,
    anchors: dict[str, str],
    events: list[Event],
    evidence: list[EvidenceItem],
) -> OffsetEstimate | None:
    """Estimate one source's clock offset from its anchor events.

    anchors maps an event of this source to the reference event it records. Only reference
    events from a source on the reference clock count; anything else is skipped.
    """
    by_id = {e.id: e for e in events}
    clocks = {e.id: e.clock.method for e in evidence}
    found: list[Anchor] = []
    for event_id, reference_id in sorted(anchors.items()):
        event, reference = by_id.get(event_id), by_id.get(reference_id)
        if not event or not reference or event.evidence_id != item.id:
            continue
        if clocks.get(reference.evidence_id) != REFERENCE_METHOD:
            continue
        if not event.source_time or not reference.source_time:
            continue
        found.append(
            Anchor(
                event_id=event.id,
                reference_event_id=reference.id,
                reference_evidence_id=reference.evidence_id,
                delta_seconds=_seconds_between(event.source_time, reference.source_time),
            )
        )
    if not found:
        return None
    deltas = [a.delta_seconds for a in found]
    return OffsetEstimate(
        evidence_id=item.id,
        offset_seconds=round(median(deltas)),
        spread_seconds=max(deltas) - min(deltas),
        anchors=found,
    )


def describe(estimate: OffsetEstimate) -> str:
    n = len(estimate.anchors)
    agreement = (
        "agree exactly" if estimate.spread_seconds == 0 else f"spread {estimate.spread_seconds} s"
    )
    return f"Inferred from {n} anchor{'s' if n != 1 else ''}; estimates {agreement}."
