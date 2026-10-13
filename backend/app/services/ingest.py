"""Build evidence items and events from a seed case directory.

CSV evidence is hashed and parsed for real. Video, audio and PDF evidence has no file in the
demo; its events come from seed metadata and are marked as simulated.
"""

from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from app.models.domain import (
    AuditEvent,
    Case,
    Claim,
    ClaimState,
    ClockAssumption,
    Event,
    EvidenceItem,
    EvidenceType,
    ExtractionMethod,
    Hypothesis,
    ProcessingStatus,
)
from app.services.normalize import normalize

SEED_ROOT = Path(__file__).resolve().parent.parent / "seed"


@dataclass
class SeedCase:
    case: Case
    subject_asset: str | None
    evidence: list[EvidenceItem]
    events: list[Event]
    claims: list[Claim]
    hypotheses: list[Hypothesis]
    audit: list[AuditEvent]
    authoritative_for: dict[str, list[str]] = field(default_factory=dict)
    files: dict[str, Path] = field(default_factory=dict)


def _in_window(ts: str, start: datetime, end: datetime) -> bool:
    try:
        t = datetime.fromisoformat(ts)
    except ValueError:
        return False
    return t.tzinfo is not None and start <= t <= end


def _describe(row: dict[str, str], templates: dict[str, str]) -> str:
    code = row.get("event_code", "")
    template = templates.get(code)
    if template:
        try:
            return template.format(**row)
        except KeyError:
            pass
    return " ".join(v for k, v in row.items() if k not in {"row", "timestamp"} and v)


def _csv_events(
    case: Case,
    item: EvidenceItem,
    path: Path,
    subject_asset: str | None,
    event_ids: dict[str, str],
    templates: dict[str, str],
) -> list[Event]:
    start = datetime.fromisoformat(case.incident_start)
    end = datetime.fromisoformat(case.incident_end)
    events: list[Event] = []
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            ts = row.get("timestamp", "")
            if not _in_window(ts, start, end):
                continue
            asset = row.get("asset_id", "")
            is_door_event = row.get("event_code", "").startswith("DOOR_")
            if "asset_id" in row and asset != subject_asset and not is_door_event:
                continue
            n = normalize(ts, item.clock.offset_seconds)
            key = f"{item.id}:{row['row']}"
            events.append(
                Event(
                    id=event_ids.get(key, f"{item.id}-R{row['row']}"),
                    case_id=case.id,
                    evidence_id=item.id,
                    locator=f"row {row['row']}",
                    description=_describe(row, templates),
                    source_time=ts,
                    normalized_time=n.normalized_time,
                    offset_seconds=n.offset_seconds,
                    normalization_rule=n.rule,
                    state=ClaimState.SUPPORTED,
                    record={k: v for k, v in row.items() if k not in {"row", "timestamp"} and v},
                )
            )
    return events


def load_seed(name: str = "case_001") -> SeedCase:
    root = SEED_ROOT / name
    data = json.loads((root / "case.json").read_text(encoding="utf-8"))
    raw_case = data["case"]
    subject_asset = raw_case.pop("subject_asset", None)
    case = Case(**raw_case)

    evidence: list[EvidenceItem] = []
    events: list[Event] = []
    authoritative: dict[str, list[str]] = {}
    files: dict[str, Path] = {}

    for raw in data["evidence"]:
        file_name = raw.get("file")
        sha = size = None
        if file_name:
            path = root / file_name
            content = path.read_bytes()
            sha, size = hashlib.sha256(content).hexdigest(), len(content)
            files[raw["id"]] = path
        item = EvidenceItem(
            id=raw["id"],
            case_id=case.id,
            type=EvidenceType(raw["type"]),
            source_name=raw["source_name"],
            original_filename=raw["original_filename"],
            sha256=sha,
            size_bytes=size,
            ingested_at=data["ingested_at"],
            processing_status=ProcessingStatus.EXTRACTED,
            extraction_method=(
                ExtractionMethod.CSV_PARSER if file_name else ExtractionMethod.SIMULATED
            ),
            clock=ClockAssumption(**raw["clock"]),
            simulated=not file_name,
        )
        evidence.append(item)
        authoritative[item.id] = raw.get("authoritative_for", [])

    by_id = {e.id: e for e in evidence}
    for item_id, path in files.items():
        events += _csv_events(
            case, by_id[item_id], path, subject_asset, data["event_ids"], data["row_descriptions"]
        )

    for raw in data["metadata_events"]:
        item = by_id[raw["evidence_id"]]
        approx = raw.get("approximate_seconds", 0)
        n = normalize(raw["source_time"], item.clock.offset_seconds, approx)
        if approx:
            state = ClaimState.UNRESOLVED
        elif raw.get("interpretation"):
            state = ClaimState.INFERRED
        else:
            state = ClaimState.SUPPORTED
        events.append(
            Event(
                id=raw["id"],
                case_id=case.id,
                evidence_id=item.id,
                locator=raw["locator"],
                description=raw["description"],
                source_time=raw["source_time"],
                normalized_time=n.normalized_time,
                offset_seconds=n.offset_seconds,
                normalization_rule=n.rule,
                approximate=bool(approx),
                uncertainty_seconds=n.uncertainty_seconds,
                state=state,
            )
        )

    claims = [Claim(case_id=case.id, **c) for c in data["claims"]]
    hypotheses = [Hypothesis(case_id=case.id, **h) for h in data["hypotheses"]]
    audit = [
        AuditEvent(id=f"A-{i:03d}", case_id=case.id, **a) for i, a in enumerate(data["audit"], 1)
    ]
    return SeedCase(
        case, subject_asset, evidence, events, claims, hypotheses, audit, authoritative, files
    )
