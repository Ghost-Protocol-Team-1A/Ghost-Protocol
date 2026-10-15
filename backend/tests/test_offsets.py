"""Clock offset inference from anchor events."""

from app.models.domain import ClockAssumption, Event, EvidenceItem
from app.services.offsets import infer_offset


def item(id_, method="reference_clock", anchors=None):
    return EvidenceItem(
        id=id_,
        case_id="C",
        type="video",
        source_name=id_,
        original_filename=f"{id_}.mp4",
        ingested_at="2026-10-11T09:00:00Z",
        processing_status="extracted",
        extraction_method="simulated_from_seed_metadata",
        simulated=True,
        clock=ClockAssumption(method=method, anchors=anchors or {}),
    )


def event(id_, evidence_id, hhmmss):
    return Event(
        id=id_,
        case_id="C",
        evidence_id=evidence_id,
        locator="t",
        description=id_,
        source_time=f"2026-10-10T{hhmmss}+01:00",
        normalized_time=None,
        normalization_rule="reference_clock",
        state="supported",
    )


REF = item("R")
CAM = item("CAM", "infer_from_anchors", {"A1": "R1", "A2": "R2"})


def test_two_agreeing_anchors_give_the_offset_with_no_spread():
    events = [
        event("R1", "R", "21:12:00"),
        event("R2", "R", "21:16:00"),
        event("A1", "CAM", "21:14:00"),
        event("A2", "CAM", "21:18:00"),
    ]
    est = infer_offset(CAM, CAM.clock.anchors, events, [REF, CAM])
    assert est.offset_seconds == 120
    assert est.spread_seconds == 0
    assert [a.delta_seconds for a in est.anchors] == [120, 120]


def test_disagreeing_anchors_use_the_median_and_report_the_spread():
    cam = item("CAM", "infer_from_anchors", {"A1": "R1", "A2": "R2", "A3": "R3"})
    events = [
        event("R1", "R", "21:00:00"),
        event("R2", "R", "21:10:00"),
        event("R3", "R", "21:20:00"),
        event("A1", "CAM", "21:01:30"),  # +90
        event("A2", "CAM", "21:12:00"),  # +120
        event("A3", "CAM", "21:22:10"),  # +130
    ]
    est = infer_offset(cam, cam.clock.anchors, events, [REF, cam])
    assert est.offset_seconds == 120
    assert est.spread_seconds == 40


def test_slow_clock_gives_a_negative_offset():
    events = [event("R1", "R", "21:12:00"), event("A1", "CAM", "21:10:30")]
    cam = item("CAM", "infer_from_anchors", {"A1": "R1"})
    assert infer_offset(cam, cam.clock.anchors, events, [REF, cam]).offset_seconds == -90


def test_anchor_against_a_non_reference_source_is_ignored():
    other = item("O", "approximate_human_estimate")
    events = [event("O1", "O", "21:12:00"), event("A1", "CAM", "21:14:00")]
    cam = item("CAM", "infer_from_anchors", {"A1": "O1"})
    assert infer_offset(cam, cam.clock.anchors, events, [other, cam]) is None


def test_no_anchors_means_no_estimate():
    cam = item("CAM", "infer_from_anchors", {})
    assert infer_offset(cam, {}, [], [REF, cam]) is None
