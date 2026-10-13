"""Time normalization.

The source timestamp is never modified. Normalization produces a separate UTC value plus the
rule that produced it, so a reviewer can always see how a normalized time was derived.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


@dataclass(frozen=True)
class Normalized:
    normalized_time: str | None
    offset_seconds: int
    rule: str
    uncertainty_seconds: int


def _to_utc_iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def normalize(
    source_time: str | None,
    offset_seconds: int = 0,
    approximate_seconds: int = 0,
) -> Normalized:
    """Derive a normalized UTC time from a recorded source time.

    offset_seconds > 0 means the source clock runs fast (normalized = source - offset).
    An unknown timezone is never assumed to be UTC: the result is left null.
    """
    if source_time is None or not source_time.strip():
        return Normalized(None, 0, "missing_timestamp", 0)

    try:
        parsed = datetime.fromisoformat(source_time)
    except ValueError:
        return Normalized(None, 0, "invalid_timestamp", 0)

    if parsed.tzinfo is None:
        return Normalized(None, 0, "timezone_unknown", 0)

    adjusted = parsed - timedelta(seconds=offset_seconds)
    if offset_seconds:
        direction = "fast" if offset_seconds > 0 else "slow"
        rule = (
            f"clock_offset:{-offset_seconds:+d}s "
            f"(source clock {abs(offset_seconds)}s {direction})"
        )
    else:
        rule = "reference_clock"
    if approximate_seconds:
        rule += f"; approximate ±{approximate_seconds}s"

    return Normalized(_to_utc_iso(adjusted), offset_seconds, rule, approximate_seconds)
