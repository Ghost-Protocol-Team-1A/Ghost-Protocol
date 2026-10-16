"""Evidence upload route.

Applies the checks from app/storage/ (owned by @mallison031): the bytes are validated against
the allow-list, hashed in chunks, and stored under their digest. This route then wires the
result into the case store, where the item appears in the inventory, the report and the audit
trail.

Logs (CSV, JSON, text) are parsed straight away into events and the rules re-run, so the
upload's effect shows in the change summary. Audio and video keep the start time their file
records, and wait for an investigator's observations or accepted AI suggestions. Duplicate
bytes return the item that already holds them instead of creating a second one.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO

from fastapi import APIRouter, Response, UploadFile
from fastapi.responses import FileResponse

from app.api.routes.cases import get_case
from app.errors import ApiError, not_found
from app.models.domain import (
    ChangeSummary,
    ClaimState,
    ClockAssumption,
    Event,
    EvidenceItem,
    EvidenceType,
    ExtractionMethod,
    ProcessingStatus,
)
from app.services.extract import media_start_time, parse_log
from app.services.normalize import normalize
from app.services.store import CaseData, clock_suffix, store
from app.storage.hashing import CHUNK_SIZE, sha256_stream, stored_path
from app.storage.validation import (
    MEDIA_TYPES,
    clean_filename,
    detect_type,
    extension_of,
    max_upload_bytes,
)

router = APIRouter(prefix="/api", tags=["evidence"])

# Enough bytes for every signature and a fair sample of a text file, small enough to stay in
# memory for every upload.
DETECTION_HEAD_BYTES = 64 * 1024

# Types parsed deterministically on upload. The rest need a person (observations) or accepted
# AI suggestions before they produce events.
_DETERMINISTIC = {EvidenceType.CSV, EvidenceType.JSON, EvidenceType.TEXT}
_TIMED_MEDIA = {EvidenceType.VIDEO, EvidenceType.AUDIO}
# The 'moov' box with the recording's start time can sit at either end of the file.
_MEDIA_TAIL_BYTES = 4 * 1024 * 1024


class EvidenceUpload(EvidenceItem):
    """An uploaded evidence item. ``duplicate`` is true when these bytes were already stored."""

    duplicate: bool = False
    change: ChangeSummary | None = None


def _detection_head(head: bytes) -> bytes:
    """Trim a multi-byte character cut in half by the head read.

    A UTF-8 file larger than the head can have a character straddle the boundary; that
    truncation is ours, not the file's, so it must not fail the text check. A genuinely
    invalid byte is left in place for detect_type to reject.
    """
    if len(head) < DETECTION_HEAD_BYTES:
        return head  # the whole file was read: an invalid byte here is the file's own
    while head:
        try:
            head.decode("utf-8")
        except UnicodeDecodeError as exc:
            if exc.start >= len(head) - 3:  # at most a 4-byte character can be split
                head = head[: exc.start]
                continue
        break
    return head


def _next_evidence_id(data: CaseData) -> str:
    """Next free ``E-`` id, skipping staged items so a later live add cannot collide."""
    used = {int(e.id[2:]) for e in data.evidence if e.id[2:].isdigit()}
    used |= {int(s.evidence_id[2:]) for s in data.staged() if s.evidence_id[2:].isdigit()}
    return f"E-{max(used, default=0) + 1:02d}"


def _store_bytes(stream: BinaryIO, path: Path) -> None:
    """Copy the upload to its digest path in chunks, then swap it in whole.

    Bytes are written to a temporary name first: an interrupted upload must not leave a
    partial file at the digest path, where later uploads would read it back as complete.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.part")
    try:
        stream.seek(0)
        with temporary.open("wb") as target:
            shutil.copyfileobj(stream, target, CHUNK_SIZE)
        temporary.replace(path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


@router.post("/cases/{case_id}/evidence", response_model=EvidenceUpload, status_code=201)
def upload_evidence(case_id: str, file: UploadFile, response: Response) -> EvidenceUpload:
    """Store an uploaded evidence file: validate it, hash the original bytes, register it.

    Returns 201 for a new item and 200 (with ``duplicate: true``) when the case already holds
    these bytes. Errors share the API's one shape: 413 too large, 415 type not allowed or
    type mismatch, 422 empty or invalid, 404 unknown case.
    """
    data = get_case(case_id)  # raises the shared 404 shape for an unknown case

    stream = file.file
    label = clean_filename(file.filename or "")
    head = _detection_head(stream.read(DETECTION_HEAD_BYTES))
    evidence_type = detect_type(file.filename or "", head)  # raises 422 empty, 415 mismatch

    stream.seek(0)
    digest, size = sha256_stream(stream, max_upload_bytes())  # raises 413 past the limit

    existing = next((item for item in data.evidence if item.sha256 == digest), None)
    if existing is not None:
        response.status_code = 200
        store.record(
            case_id, "API", "Duplicate upload skipped", existing.id, f"{label} · same bytes"
        )
        return EvidenceUpload(**existing.model_dump(), duplicate=True)

    path = stored_path(digest)
    if not path.exists():
        _store_bytes(stream, path)

    item = EvidenceItem(
        id=_next_evidence_id(data),
        case_id=case_id,
        type=evidence_type,
        source_name=label,
        original_filename=label,
        sha256=digest,
        size_bytes=size,
        ingested_at=store.now(),
        processing_status=ProcessingStatus.QUEUED,
        extraction_method=ExtractionMethod.NONE,
        clock=ClockAssumption(),
        simulated=False,
    )
    if evidence_type in _TIMED_MEDIA:
        item.clock = ClockAssumption(
            method="not_set", note="Device clock not verified. Set it on the evidence page."
        )
        item.recorded_at = _recorded_at(path)
        item.extraction_note = "Waiting for observations" + (
            f" · file says recording started {item.recorded_at}" if item.recorded_at else ""
        )
    elif evidence_type not in _DETERMINISTIC:
        item.extraction_note = "Waiting for AI suggestions or manual events"

    data.evidence.append(item)
    if evidence_type is EvidenceType.CSV:
        # Register the stored bytes so the evidence viewer can show the original rows,
        # exactly as it does for seeded CSVs. Non-CSV uploads have no row structure.
        data.files[item.id] = path
    store.record(case_id, "API", "Evidence uploaded", item.id, f"{label} · sha256 {digest[:12]}")

    change = None
    if evidence_type in _DETERMINISTIC:
        change = _extract_log(data, item, path)
        store.record(case_id, "SYS", "Events extracted", item.id, item.extraction_note)
    return EvidenceUpload(**item.model_dump(), change=change)


def _recorded_at(path: Path) -> str | None:
    with path.open("rb") as fh:
        head = fh.read(DETECTION_HEAD_BYTES)
        found = media_start_time(head)
        if found:
            return found
        fh.seek(0, 2)
        size = fh.tell()
        fh.seek(max(0, size - _MEDIA_TAIL_BYTES))
        return media_start_time(fh.read())


def _extract_log(data: CaseData, item: EvidenceItem, path: Path) -> ChangeSummary:
    """Parse a stored log into events, add them, and re-run the rules."""
    kind = {EvidenceType.CSV: "csv", EvidenceType.JSON: "json"}.get(item.type, "text")
    result = parse_log(kind, path.read_bytes(), data.case.incident_start)
    events = []
    for i, row in enumerate(result.rows if result else [], 1):
        n = normalize(row.source_time, item.clock.offset_seconds)
        assumed = "; UTC offset assumed from the case window" if row.timezone_assumed else ""
        events.append(
            Event(
                id=f"{item.id}-R{i}",
                case_id=data.case.id,
                evidence_id=item.id,
                locator=row.locator,
                description=row.description,
                source_time=row.source_time,
                normalized_time=n.normalized_time,
                offset_seconds=n.offset_seconds,
                normalization_rule=f"{n.rule}{clock_suffix(item)}{assumed}",
                state=ClaimState.SUPPORTED,
                record=row.record,
            )
        )
    item.processing_status = ProcessingStatus.EXTRACTED
    item.extraction_method = (
        ExtractionMethod.CSV_PARSER
        if item.type is EvidenceType.CSV
        else ExtractionMethod.LOG_PARSER
    )
    item.extraction_note = result.note if result else "No parser for this type"
    trigger = f"Uploaded {item.id} · {item.original_filename} · {len(events)} events"
    return data.add_events(item, events, store.now(), trigger)


def original_path(data: CaseData, item: EvidenceItem) -> Path | None:
    """Where an item's original bytes are on disk, or None when there is no file."""
    path = data.files.get(item.id)
    if path is None and item.sha256:
        candidate = stored_path(item.sha256)
        path = candidate if candidate.exists() else None
    return path


@router.get("/cases/{case_id}/evidence/{evidence_id}/file")
def read_evidence_file(case_id: str, evidence_id: str) -> FileResponse:
    """Stream the original bytes of an evidence item, with Range support for audio and video.

    The bytes are served exactly as stored, so their SHA-256 still matches the inventory.
    Responses are sandboxed and never sniffed, so a stored file cannot run as a page.
    """
    data = get_case(case_id)
    item = next((e for e in data.evidence if e.id == evidence_id), None)
    if item is None:
        raise not_found("evidence", evidence_id)
    path = original_path(data, item)
    if path is None:
        raise ApiError(
            404,
            "original_not_available",
            f"No original file is stored for {evidence_id}; its events come from seed metadata.",
        )
    media_type = MEDIA_TYPES.get(extension_of(item.original_filename), "application/octet-stream")
    headers = {"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"}
    if media_type != "application/pdf":  # a sandboxed PDF will not open in the browser viewer
        headers["Content-Security-Policy"] = "sandbox; default-src 'none'; media-src 'self'"
    return FileResponse(
        path,
        media_type=media_type,
        filename=item.original_filename,
        content_disposition_type="inline",
        headers=headers,
    )
