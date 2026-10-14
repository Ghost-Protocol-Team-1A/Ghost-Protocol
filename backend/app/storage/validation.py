"""Upload validation — owned by @mallison031 (issue: Evidence upload checks)."""

from __future__ import annotations

import os
import unicodedata
from collections.abc import Callable

from app.errors import ApiError
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

DEFAULT_MAX_UPLOAD_MB = 50
MAX_FILENAME_LENGTH = 120
UNNAMED = "unnamed"

# First bytes that identify a format on their own. Used two ways: to say what a mismatched
# upload actually is, and to keep a binary file from passing as .csv or .txt.
_MAGICS: tuple[tuple[bytes, str], ...] = (
    (b"%PDF-", "pdf"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"RIFF", "RIFF (wav/avi)"),
    (b"ID3", "mp3"),
    (b"\x00\x00\x00\x18ftyp", "mp4"),
    (b"ftyp", "mp4"),
    (b"PK\x03\x04", "zip (docx/xlsx)"),
    (b"MZ", "windows executable"),
    (b"\x7fELF", "elf executable"),
    (b"\x1f\x8b", "gzip"),
)

_BOM = b"\xef\xbb\xbf"


def _starts_with(*prefixes: bytes) -> Callable[[bytes], bool]:
    return lambda head: any(head.startswith(p) for p in prefixes)


def _is_mp4(head: bytes) -> bool:
    """ISO Base Media boxes are size(4) + 'ftyp'; the marker is at offset 4."""
    return head[4:8] == b"ftyp"


def _is_wav(head: bytes) -> bool:
    return head.startswith(b"RIFF") and head[8:12] == b"WAVE"


def _is_mp3(head: bytes) -> bool:
    """An ID3 tag, or a frame sync: 11 set bits, so 0xFF then 0xEx..0xFx."""
    if head.startswith(b"ID3"):
        return True
    return len(head) >= 2 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0


def _is_json(head: bytes) -> bool:
    body = head.removeprefix(_BOM).lstrip()
    return bool(body) and body[:1] in b'{["-0123456789tf'


def _is_text(head: bytes) -> bool:
    """Plain text: no other format's signature, no NUL, and valid UTF-8."""
    if any(head.startswith(magic) for magic, _ in _MAGICS):
        return False
    if b"\x00" in head:
        return False
    try:
        head.removeprefix(_BOM).decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


_CHECKERS: dict[str, tuple[Callable[[bytes], bool], EvidenceType]] = {
    "mp4": (_is_mp4, EvidenceType.VIDEO),
    "wav": (_is_wav, EvidenceType.AUDIO),
    "mp3": (_is_mp3, EvidenceType.AUDIO),
    "png": (_starts_with(b"\x89PNG\r\n\x1a\n"), EvidenceType.IMAGE),
    "jpg": (_starts_with(b"\xff\xd8\xff"), EvidenceType.IMAGE),
    "pdf": (_starts_with(b"%PDF-"), EvidenceType.PDF),
    "json": (_is_json, EvidenceType.JSON),
    "csv": (_is_text, EvidenceType.CSV),
    "txt": (_is_text, EvidenceType.TEXT),
}


def max_upload_bytes() -> int:
    """The upload ceiling from MAX_UPLOAD_MB (default 50 MiB).

    An unparsable or non-positive value falls back to the default: a typo in the environment
    must not silently turn the limit into zero, which would reject every upload.
    """
    raw = os.getenv("MAX_UPLOAD_MB", "").strip()
    try:
        megabytes = int(raw)
    except ValueError:
        return DEFAULT_MAX_UPLOAD_MB * 1024 * 1024
    if megabytes <= 0:
        return DEFAULT_MAX_UPLOAD_MB * 1024 * 1024
    return megabytes * 1024 * 1024


def clean_filename(name: str) -> str:
    """Strip directories and control characters; limit to 120 characters.

    The result is metadata for `EvidenceItem.original_filename` and nothing else — the file on
    disk is named by its hash — so this function's job is to make the label harmless to render
    and impossible to read as a path: `../../etc/passwd` becomes `passwd`, and a name carrying
    `\\x00` or a zero-width joiner loses those characters.

    Truncation keeps the extension, so a long name still shows which type it claims to be.
    """
    base = name.replace("\\", "/").rsplit("/", 1)[-1]
    kept = "".join(ch for ch in base if not unicodedata.category(ch).startswith("C"))
    cleaned = kept.strip().lstrip(".").rstrip(" ")
    if not cleaned:
        return UNNAMED
    if len(cleaned) <= MAX_FILENAME_LENGTH:
        return cleaned
    stem, dot, ext = cleaned.rpartition(".")
    if dot and 0 < len(ext) < MAX_FILENAME_LENGTH:
        return f"{stem[: MAX_FILENAME_LENGTH - len(ext) - 1]}{dot}{ext}"
    return cleaned[:MAX_FILENAME_LENGTH]


def extension_of(filename: str) -> str:
    """Lowercased extension of the *cleaned* name, or "" when it has none."""
    cleaned = clean_filename(filename)
    _, dot, ext = cleaned.rpartition(".")
    return ext.lower() if dot else ""


def detected_signature(head: bytes) -> str:
    """Best guess at what the bytes actually are, for the mismatch message."""
    for magic, label in _MAGICS:
        if head.startswith(magic):
            return label
    if _is_text(head):
        return "text"
    return "unknown binary"


def detect_type(filename: str, head: bytes) -> EvidenceType:
    """Check the extension against ALLOWED_EXTENSIONS and the first bytes against the type.

    Raise app.errors.ApiError(415, ...) when the type is not allowed or does not match.
    Raise app.errors.ApiError(422, ...) for an empty file.

    Both halves are required on purpose. The extension alone lets an executable through named
    `.pdf`; the bytes alone would accept any text file whatever it is called, so the claim and
    the evidence have to agree before the upload is stored. The name in the messages is the
    cleaned one, so a rejected upload cannot use an error response to inject text.
    """
    if not head:
        raise ApiError(
            422,
            "empty_file",
            f"{clean_filename(filename)} has no bytes to verify.",
            {"filename": clean_filename(filename)},
        )

    label = clean_filename(filename)
    ext = extension_of(filename)
    checker = _CHECKERS.get(ext)
    if checker is None:
        raise ApiError(
            415,
            "type_not_allowed",
            f".{ext or '?'} is not an accepted evidence type.",
            {
                "filename": label,
                "extension": ext,
                "allowed": sorted(ALLOWED_EXTENSIONS),
            },
        )

    matches, evidence_type = checker
    if not matches(head):
        raise ApiError(
            415,
            "type_mismatch",
            f".{ext} content was expected for {label}, but its bytes look like "
            f"{detected_signature(head)}.",
            {
                "filename": label,
                "extension": ext,
                "detected": detected_signature(head),
            },
        )
    return evidence_type
