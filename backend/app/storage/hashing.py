"""Streaming SHA-256 — owned by @mallison031 (issue: Evidence upload checks)."""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path
from typing import BinaryIO

from app.errors import ApiError

CHUNK_SIZE = 1024 * 1024

DEFAULT_STORAGE_DIR = "backend/data/evidence"

_HEX = re.compile(r"[0-9a-f]{64}")


def sha256_stream(stream: BinaryIO, max_bytes: int) -> tuple[str, int]:
    """Return (hex digest, size in bytes) of the stream, reading it in chunks.

    Raise app.errors.ApiError(413, ...) as soon as more than max_bytes have been read.

    The digest is updated per chunk and nothing is concatenated, so a 40 GB upload hashes
    with the same memory as a 40 KB one. The size limit is checked before the chunk reaches
    the hash, so an oversize file is refused mid-stream rather than after it is read.
    """
    digest = hashlib.sha256()
    size = 0
    while True:
        chunk = stream.read(CHUNK_SIZE)
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            raise ApiError(
                413,
                "file_too_large",
                f"File is larger than the {max_bytes} byte upload limit.",
                {"max_bytes": max_bytes, "read_bytes": size},
            )
        digest.update(chunk)
    return digest.hexdigest(), size


def storage_dir() -> Path:
    """Where original bytes live (GP_STORAGE_DIR). Read per call so tests can point it elsewhere."""
    return Path(os.getenv("GP_STORAGE_DIR") or DEFAULT_STORAGE_DIR)


def stored_path(sha256: str, base: Path | None = None) -> Path:
    """Path an upload's bytes are written to: ``<storage>/<sha256[:2]>/<sha256>``.

    Every component comes from the digest, never from the client: two uploads of the same
    bytes land on the same path, which is what lets the route answer "duplicate" instead of
    storing a second copy. The digest is re-checked as 64 hex characters here so no caller,
    however it obtained the string, can turn a path component into traversal.
    """
    if not _HEX.fullmatch(sha256):
        raise ApiError(
            422,
            "invalid_digest",
            "A stored path needs the 64-character SHA-256 hex digest of the bytes.",
            {"sha256_length": len(sha256)},
        )
    return (base or storage_dir()) / sha256[:2] / sha256
