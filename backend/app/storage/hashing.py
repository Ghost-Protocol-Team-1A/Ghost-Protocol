"""Streaming SHA-256 — owned by @mallison031 (issue: Evidence upload checks)."""

from __future__ import annotations

from typing import BinaryIO

CHUNK_SIZE = 1024 * 1024


def sha256_stream(stream: BinaryIO, max_bytes: int) -> tuple[str, int]:
    """Return (hex digest, size in bytes) of the stream, reading it in chunks.

    Raise app.errors.ApiError(413, ...) as soon as more than max_bytes have been read.
    """
    raise NotImplementedError
