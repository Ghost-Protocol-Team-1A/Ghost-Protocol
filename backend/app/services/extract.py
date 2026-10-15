"""Deterministic extraction of uploaded log files, and start times read from media files.

Rows become events only when they carry a timestamp that can be read without guessing the
date. A timestamp without a UTC offset takes the offset of the case's incident window, and
the event's normalization rule says so. Nothing here interprets meaning: a row's text is
kept as recorded.
"""

from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

MAX_EVENTS_PER_FILE = 2000

_TIME_KEYS = re.compile(
    r"(^|_)(time|timestamp|datetime|date_?time|at|ts|logged|occurred)(_|$)", re.I
)
_LINE = re.compile(
    r"^\s*\[?(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?"
    r"(?:Z|[+-]\d{2}:?\d{2})?)\]?"
    r"\s*[-–|:]?\s*(?P<text>.*)$"
)


@dataclass
class ParsedRow:
    locator: str
    source_time: str
    description: str
    record: dict[str, str] = field(default_factory=dict)
    timezone_assumed: bool = False


@dataclass
class ParseResult:
    rows: list[ParsedRow]
    skipped_no_time: int = 0
    format: str = ""
    time_field: str | None = None

    @property
    def note(self) -> str:
        parts = [f"{len(self.rows)} timed {'entry' if len(self.rows) == 1 else 'entries'}"]
        if self.time_field:
            parts.append(f"time from '{self.time_field}'")
        if self.skipped_no_time:
            parts.append(f"{self.skipped_no_time} without a readable time")
        return f"{self.format}: " + ", ".join(parts)


def _tz_of(window_start: str) -> str:
    """'+01:00' from the case window, used for times recorded without an offset."""
    dt = datetime.fromisoformat(window_start)
    offset = dt.utcoffset() or timedelta(0)
    minutes = int(offset.total_seconds() // 60)
    sign = "+" if minutes >= 0 else "-"
    return f"{sign}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}"


def read_time(value: str, tz: str) -> tuple[str, bool] | None:
    """An ISO-like time with a full date, as (iso with offset, offset was assumed)."""
    text = value.strip().replace(" ", "T", 1)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    if not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", text):
        return None
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return datetime.fromisoformat(text + tz).isoformat(), True
    return dt.isoformat(), False


def _describe(record: dict[str, str], skip: str) -> str:
    text = " · ".join(v for k, v in record.items() if k != skip and k.lower() != "row" and v)
    return text[:300] or "(no other fields)"


def _time_field(names: list[str], sample: list[dict[str, str]], tz: str) -> str | None:
    named = [n for n in names if _TIME_KEYS.search(n)]
    for name in named + [n for n in names if n not in named]:
        values = [r.get(name, "") for r in sample if r.get(name)]
        if values and all(read_time(v, tz) for v in values[:5]):
            return name
    return None


def _from_records(records: list[dict[str, str]], fmt: str, tz: str, label: str) -> ParseResult:
    names = list(records[0].keys()) if records else []
    field_name = _time_field(names, records[:20], tz)
    result = ParseResult(rows=[], format=fmt, time_field=field_name)
    if field_name is None:
        result.skipped_no_time = len(records)
        return result
    for i, rec in enumerate(records, 1):
        parsed = read_time(rec.get(field_name, ""), tz)
        if parsed is None:
            result.skipped_no_time += 1
            continue
        if len(result.rows) >= MAX_EVENTS_PER_FILE:
            break
        locator = f"{label} {rec.get('row') or i}"
        result.rows.append(
            ParsedRow(
                locator=locator,
                source_time=parsed[0],
                description=_describe(rec, field_name),
                record={k: v for k, v in rec.items() if k != field_name and v},
                timezone_assumed=parsed[1],
            )
        )
    return result


def parse_csv(data: bytes, tz: str) -> ParseResult:
    text = data.decode("utf-8-sig", errors="replace")
    records = [
        {k: (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(io.StringIO(text))
    ]
    return _from_records(records, "CSV", tz, "row")


def parse_json(data: bytes, tz: str) -> ParseResult:
    try:
        doc = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return ParseResult(rows=[], format="JSON")
    if isinstance(doc, dict):
        doc = next((v for v in doc.values() if isinstance(v, list)), [])
    records = [
        {
            str(k): "" if v is None else str(v)
            for k, v in item.items()
            if not isinstance(v, (dict, list))
        }
        for item in doc
        if isinstance(item, dict)
    ]
    return _from_records(records, "JSON", tz, "item")


def parse_lines(data: bytes, tz: str) -> ParseResult:
    result = ParseResult(rows=[], format="Text log", time_field="line start")
    for n, line in enumerate(data.decode("utf-8-sig", errors="replace").splitlines(), 1):
        if not line.strip():
            continue
        m = _LINE.match(line)
        parsed = read_time(m["ts"], tz) if m else None
        if parsed is None:
            result.skipped_no_time += 1
            continue
        if len(result.rows) >= MAX_EVENTS_PER_FILE:
            break
        result.rows.append(
            ParsedRow(
                locator=f"line {n}",
                source_time=parsed[0],
                description=(m["text"].strip() or "(no text)")[:300],
                timezone_assumed=parsed[1],
            )
        )
    return result


PARSERS = {"csv": parse_csv, "json": parse_json, "text": parse_lines}


def parse_log(kind: str, data: bytes, window_start: str) -> ParseResult | None:
    """Parse a log by evidence type ('csv', 'json' or 'text'); None for other types."""
    parser = PARSERS.get(kind)
    return parser(data, _tz_of(window_start)) if parser else None


# --- media start time ---------------------------------------------------------------------------

_MAC_EPOCH = datetime(1904, 1, 1, tzinfo=UTC)


def media_start_time(head: bytes) -> str | None:
    """Creation time from an MP4/MOV/M4A 'mvhd' box, as UTC ISO; None when absent or zero.

    Cameras and phones write this when recording starts. It is the device's own clock, so it
    is shown as a claim of the file, not a verified time.
    """
    at = head.find(b"mvhd")
    if at < 0 or len(head) < at + 16:
        return None
    version = head[at + 4]
    if version == 1:
        if len(head) < at + 16:
            return None
        seconds = int.from_bytes(head[at + 8 : at + 16], "big")
    else:
        seconds = int.from_bytes(head[at + 8 : at + 12], "big")
    if seconds == 0:
        return None
    try:
        when = _MAC_EPOCH + timedelta(seconds=seconds)
    except OverflowError:
        return None
    if not (1990 <= when.year <= 2100):
        return None
    return when.isoformat().replace("+00:00", "Z")
