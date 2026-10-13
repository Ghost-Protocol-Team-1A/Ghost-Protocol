from app.services.normalize import normalize


def test_two_minute_fast_clock_moves_time_earlier():
    n = normalize("2026-10-10T21:16:00+01:00", offset_seconds=120)
    assert n.normalized_time == "2026-10-10T20:14:00Z"
    assert n.offset_seconds == 120
    assert "-120s" in n.rule


def test_zero_offset_only_converts_to_utc():
    n = normalize("2026-10-10T21:12:00+01:00")
    assert n.normalized_time == "2026-10-10T20:12:00Z"
    assert n.rule == "reference_clock"


def test_slow_clock_moves_time_later():
    n = normalize("2026-10-10T21:00:00+01:00", offset_seconds=-90)
    assert n.normalized_time == "2026-10-10T20:01:30Z"


def test_unknown_timezone_is_not_assumed_utc():
    n = normalize("2026-10-10T21:12:00")
    assert n.normalized_time is None
    assert n.rule == "timezone_unknown"


def test_missing_and_invalid_timestamps():
    assert normalize(None).rule == "missing_timestamp"
    assert normalize("  ").rule == "missing_timestamp"
    assert normalize("not a time").rule == "invalid_timestamp"


def test_approximate_time_keeps_uncertainty():
    n = normalize("2026-10-10T21:18:00+01:00", approximate_seconds=120)
    assert n.uncertainty_seconds == 120
    assert "approximate" in n.rule


def test_day_boundary_crossing():
    n = normalize("2026-10-11T00:01:00+01:00", offset_seconds=120)
    assert n.normalized_time == "2026-10-10T22:59:00Z"


def test_equal_normalized_times_from_different_sources():
    fast = normalize("2026-10-10T21:16:00+01:00", offset_seconds=120)
    ref = normalize("2026-10-10T21:14:00+01:00")
    assert fast.normalized_time == ref.normalized_time
