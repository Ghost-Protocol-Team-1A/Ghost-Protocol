"""Evidence upload route.

Applies the checks from app/storage/ (owned by @mallison031): the bytes are validated against
the allow-list, hashed in chunks, and stored under their digest. This route then wires the
result into the case store, where the item appears in the inventory, the report and the audit
trail.

Extraction of uploaded files is out of scope here: an upload is stored, listed and provable,
and stays in ``queued`` status until an extraction step claims it. Duplicate bytes return the
item that already holds them instead of creating a second one.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO

from fastapi import APIRouter, Response, UploadFile

from app.api.routes.cases import get_case
from app.models.domain import (
    ClockAssumption,
    EvidenceItem,
    EvidenceType,
    ExtractionMethod,
    ProcessingStatus,
)
from app.services.store import CaseData, store
from app.storage.hashing import CHUNK_SIZE, sha256_stream, stored_path
from app.storage.validation import clean_filename, detect_type, max_upload_bytes

router = APIRouter(prefix="/api", tags=["evidence"])

# Enough bytes for every signature and a fair sample of a text file, small enough to stay in
# memory for every upload.
DETECTION_HEAD_BYTES = 64 * 1024

# Types this demo parses deterministically. The rest are extracted by simulated methods (see
# the report's methods and limitations), so their labels say so.
_DETERMINISTIC = {EvidenceType.CSV, EvidenceType.JSON, EvidenceType.TEXT}


class EvidenceUpload(EvidenceItem):
    """An uploaded evidence item. ``duplicate`` is true when these bytes were already stored."""

    duplicate: bool = False


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
        extraction_method=(
            ExtractionMethod.CSV_PARSER
            if evidence_type in _DETERMINISTIC
            else ExtractionMethod.SIMULATED
        ),
        clock=ClockAssumption(),
        simulated=evidence_type not in _DETERMINISTIC,
    )
    data.evidence.append(item)
    if evidence_type is EvidenceType.CSV:
        # Register the stored bytes so the evidence viewer can show the original rows,
        # exactly as it does for seeded CSVs. Non-CSV uploads have no row structure.
        data.files[item.id] = path
    store.record(case_id, "API", "Evidence uploaded", item.id, f"{label} · sha256 {digest[:12]}")
    return EvidenceUpload(**item.model_dump())
