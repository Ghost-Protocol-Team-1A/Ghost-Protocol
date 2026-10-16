"""Keeps investigator-created cases across restarts and deploys.

Each case is saved as one JSON document, and every uploaded original as one blob keyed by its
SHA-256. Where they go depends on the environment:

* ``DATABASE_URL`` set: PostgreSQL (tables ``gp_cases`` and ``gp_blobs``, created on first use).
* ``GP_DATA_DIR`` set: JSON and blob files in that folder (local runs and the container).
* neither: nothing is saved, which is what the tests and a bare checkout get.

The seeded demo case is never saved. It is rebuilt from the seed on every start and by
"Reset demo", so a deploy that changes the seed is never shadowed by an old copy.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Protocol

log = logging.getLogger("ghost_protocol.persist")

_CASE_ID = re.compile(r"^CASE-\d{3}$")
_SHA = re.compile(r"^[0-9a-f]{64}$")


class Backend(Protocol):
    def save_case(self, case_id: str, document: str) -> None: ...
    def load_cases(self) -> dict[str, str]: ...
    def save_blob(self, sha256: str, data: bytes) -> None: ...
    def load_blob(self, sha256: str) -> bytes | None: ...


class NullBackend:
    def save_case(self, case_id: str, document: str) -> None:
        return None

    def load_cases(self) -> dict[str, str]:
        return {}

    def save_blob(self, sha256: str, data: bytes) -> None:
        return None

    def load_blob(self, sha256: str) -> bytes | None:
        return None


class FileBackend:
    def __init__(self, root: Path) -> None:
        self.cases = root / "cases"
        self.blobs = root / "blobs"
        self.cases.mkdir(parents=True, exist_ok=True)
        self.blobs.mkdir(parents=True, exist_ok=True)

    def save_case(self, case_id: str, document: str) -> None:
        if not _CASE_ID.match(case_id):
            return
        target = self.cases / f"{case_id}.json"
        temporary = target.with_suffix(".part")
        temporary.write_text(document, encoding="utf-8")
        temporary.replace(target)

    def load_cases(self) -> dict[str, str]:
        files = sorted(self.cases.glob("CASE-*.json"))
        return {p.stem: p.read_text(encoding="utf-8") for p in files}

    def save_blob(self, sha256: str, data: bytes) -> None:
        if _SHA.match(sha256) and not (self.blobs / sha256).exists():
            (self.blobs / sha256).write_bytes(data)

    def load_blob(self, sha256: str) -> bytes | None:
        path = self.blobs / sha256
        return path.read_bytes() if _SHA.match(sha256) and path.exists() else None


class PostgresBackend:
    """One connection per call: the demo writes rarely and Render's free Postgres is small."""

    def __init__(self, url: str) -> None:
        import psycopg

        self._psycopg = psycopg
        self.url = url
        with self._connect() as conn:
            conn.execute(
                "create table if not exists gp_cases (case_id text primary key, "
                "data jsonb not null, updated_at timestamptz default now())"
            )
            conn.execute(
                "create table if not exists gp_blobs (sha256 text primary key, data bytea not null)"
            )

    def _connect(self):
        return self._psycopg.connect(self.url, connect_timeout=10, autocommit=True)

    def save_case(self, case_id: str, document: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "insert into gp_cases (case_id, data) values (%s, %s::jsonb) "
                "on conflict (case_id) do update set data = excluded.data, updated_at = now()",
                (case_id, document),
            )

    def load_cases(self) -> dict[str, str]:
        with self._connect() as conn:
            query = "select case_id, data::text from gp_cases order by case_id"
            rows = conn.execute(query).fetchall()
        return {case_id: data for case_id, data in rows}

    def save_blob(self, sha256: str, data: bytes) -> None:
        with self._connect() as conn:
            conn.execute(
                "insert into gp_blobs (sha256, data) values (%s, %s) on conflict do nothing",
                (sha256, data),
            )

    def load_blob(self, sha256: str) -> bytes | None:
        with self._connect() as conn:
            row = conn.execute("select data from gp_blobs where sha256 = %s", (sha256,)).fetchone()
        return bytes(row[0]) if row else None


def make_backend() -> Backend:
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        try:
            backend = PostgresBackend(url)
            log.warning("Persistence: PostgreSQL")
            return backend
        except Exception as exc:  # noqa: BLE001 - never stop the demo over storage
            log.error("Persistence: PostgreSQL unavailable (%s); falling back", type(exc).__name__)
    folder = os.getenv("GP_DATA_DIR", "").strip()
    if folder:
        log.warning("Persistence: files in %s", folder)
        return FileBackend(Path(folder))
    return NullBackend()


def dumps(document: dict) -> str:
    return json.dumps(document, sort_keys=True, separators=(",", ":"))
