"""Upload validation — owned by @mallison031 (issue: Evidence upload checks)."""

from __future__ import annotations

from app.models.domain import EvidenceType

ALLOWED_EXTENSIONS: dict[str, EvidenceType] = {
    "mp4": EvidenceType.VIDEO,
    "wav": EvidenceType.AUDIO,
    "mp3": EvidenceType.AUDIO,
    "csv": EvidenceType.CSV,
    "json": EvidenceType.JSON,
    "pdf": EvidenceType.PDF,
    "txt": EvidenceType.TEXT,
    "png": EvidenceType.IMAGE,
    "jpg": EvidenceType.IMAGE,
}


def clean_filename(name: str) -> str:
    """Strip directories and control characters; limit to 120 characters."""
    raise NotImplementedError


def detect_type(filename: str, head: bytes) -> EvidenceType:
    """Check the extension against ALLOWED_EXTENSIONS and the first bytes against the type.

    Raise app.errors.ApiError(415, ...) when the type is not allowed or does not match.
    Raise app.errors.ApiError(422, ...) for an empty file.
    """
    raise NotImplementedError
