"""AI assistance with Claude: it reads, compiles and drafts; people decide.

Every call returns structured JSON that is checked before anyone sees it:

* citations must name records that exist in the case, or the point is dropped and counted;
* a quoted sentence is matched word for word against the document's own text;
* the model is told never to assign blame or identity, and to say when the records cannot tell.

Nothing here writes to the timeline. Suggestions wait for a person to accept them, and drafts
are only ever a starting point for a signed answer.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import zipfile
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

import anthropic

from app.errors import ApiError
from app.models.domain import EvidenceItem, EvidenceType
from app.services.store import CaseData

log = logging.getLogger("ghost_protocol.ai")

MODEL = "claude-sonnet-5-5"
_BETAS = ["server-side-fallback-2026-07-01"]
MAX_TEXT_CHARS = 400_000
MAX_PDF_BYTES = 30 * 1024 * 1024
_IMAGE_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}

RULES = """You assist an incident investigator. You never decide anything; a person does.
- Use only the material you are given. Never invent records, times, people or IDs.
- Cite records by the exact IDs given (E-01, EV-012, CL-03, C-01, H-02, Q-01). Cite nothing else.
- Never say who is responsible or guilty.
- Never identify a person unless a cited record names them.
- When the records cannot settle something, say so plainly instead of guessing.
- Plain, short sentences. No speculation presented as fact."""


def configured() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _default_client() -> Any:
    if not configured():
        raise ApiError(
            503,
            "ai_not_configured",
            "AI assistance is off: add ANTHROPIC_API_KEY to the server environment to turn it on.",
        )
    # An organisation-level key must name the workspace it spends from; a workspace key need not.
    workspace = os.getenv("ANTHROPIC_WORKSPACE_ID", "").strip()
    headers = {"anthropic-workspace-id": workspace} if workspace else None
    return anthropic.Anthropic(timeout=120.0, max_retries=2, default_headers=headers)


# Tests replace this with a fake client.
client_factory: Callable[[], Any] = _default_client


def _create(client: Any, plain: bool, **params: Any) -> Any:
    """The beta call with server-side refusal fallback, or the plain call without it."""
    if plain:
        return client.messages.create(**params)
    return client.beta.messages.create(betas=_BETAS, fallbacks="default", **params)


def _call(
    system: str, content: list[dict], schema: dict, effort: str = "medium"
) -> tuple[dict, str]:
    """One structured request. Returns (parsed JSON, model that answered).

    The first attempt asks for server-side refusal fallback. If the API rejects that request
    shape (400), it is retried once as a plain structured request, and Anthropic's own reason
    is logged so a misconfiguration explains itself.
    """
    client = client_factory()
    params = {
        "model": MODEL,
        "max_tokens": 16000,
        "system": system,
        "messages": [{"role": "user", "content": content}],
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": schema}},
    }
    try:
        try:
            response = _create(client, False, **params)
        except anthropic.BadRequestError as exc:
            log.warning("AI request with fallback rejected (400): %s; retrying plain", exc.message)
            response = _create(client, True, **params)
    except anthropic.AuthenticationError as exc:
        raise ApiError(
            503, "ai_not_configured", "The AI key was rejected. Check ANTHROPIC_API_KEY."
        ) from exc
    except anthropic.RateLimitError as exc:
        raise ApiError(429, "ai_busy", "The AI service is busy. Try again in a minute.") from exc
    except anthropic.APIConnectionError as exc:
        raise ApiError(503, "ai_unreachable", "The AI service could not be reached.") from exc
    except anthropic.APIStatusError as exc:
        log.warning("AI request failed (%s): %s", exc.status_code, exc.message)
        raise ApiError(
            502,
            "ai_error",
            f"The AI service returned an error ({exc.status_code}): {exc.message[:300]}",
        ) from exc

    if response.stop_reason == "refusal":
        raise ApiError(422, "ai_declined", "The AI declined this request. Continue manually.")
    if response.stop_reason == "max_tokens":
        raise ApiError(502, "ai_incomplete", "The AI answer was cut off. Try a narrower request.")
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        return json.loads(text), getattr(response, "model", MODEL)
    except json.JSONDecodeError as exc:
        raise ApiError(502, "ai_bad_output", "The AI answer could not be read.") from exc


def _obj(properties: dict, required: list[str] | None = None) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": required or list(properties),
        "additionalProperties": False,
    }


_STR = {"type": "string"}
_CITES = {"type": "array", "items": _STR}
_POINT = _obj({"text": _STR, "cites": _CITES})


# --- case context ---------------------------------------------------------------------------


def _site_tz(incident_start: str) -> timezone:
    offset = datetime.fromisoformat(incident_start).utcoffset() or timedelta(0)
    return timezone(offset)


def _local(value: str | None, site: timezone) -> str:
    """A time as HH:MM:SS at the site, so every time the model sees is on one clock."""
    if not value:
        return "unknown"
    return (
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        .astimezone(site)
        .strftime("%Y-%m-%d %H:%M:%S")
    )


def case_context(data: CaseData) -> str:
    """The case's records as compact lines the model can cite by ID."""
    c = data.case
    lines = [
        f"CASE {c.id}: {c.title}",
        f"Window: {c.incident_start} to {c.incident_end}",
        f"Scope: {c.scope or '(none written)'}",
        "",
        "EVIDENCE",
    ]
    for e in data.evidence:
        clock = f"clock {e.clock.method}, offset {e.clock.offset_seconds}s"
        lines.append(f"{e.id} | {e.type.value} | {e.source_name} | {clock} | {e.extraction_note}")
    site = _site_tz(c.incident_start)
    lines += [
        "",
        "EVENTS",
        f"Each line: id | where | as the source's own clock recorded it | corrected to the "
        f"reference clock, in site local time ({site.tzname(None)}) | state | what.",
        "The corrected time is the source time minus the source's clock offset. Claims and "
        "questions use site local time.",
    ]
    for ev in data.events:
        lines.append(
            f"{ev.id} | {ev.evidence_id} {ev.locator} | recorded {_local(ev.source_time, site)} "
            f"| corrected {_local(ev.normalized_time, site)} | {ev.state.value} | {ev.description}"
        )
    lines += ["", "QUESTIONS"] + [f"{q.id} | {q.text}" for q in data.questions]
    lines += ["", "CLAIMS"]
    for cl in data.claims:
        cites = ", ".join(
            f"{k.evidence_id} {k.relationship} {k.locator or ''}".strip() for k in cl.links
        )
        lines.append(
            f"{cl.id} | {cl.question_id or '-'} | {cl.state.value} | {cl.statement} "
            f"| {cites or 'no citation'}"
        )
    lines += ["", "CONFLICTS"]
    for cf in data.conflicts:
        lines.append(
            f"{cf.id} | {cf.rule_id} | {cf.status.value} | {cf.explanation} "
            f"| cannot tell: {cf.uncertain}"
        )
    lines += ["", "HYPOTHESES"]
    for h in data.hypotheses:
        lines.append(
            f"{h.id} | {h.conflict_id or '-'} | {h.state.value} | {h.description} | {h.notes}"
        )
    text = "\n".join(lines)
    if len(text) > MAX_TEXT_CHARS:
        raise ApiError(
            413,
            "case_too_large_for_ai",
            "This case has too many records to send in one AI request. Narrow it first.",
        )
    return text


def _known(data: CaseData) -> set[str]:
    return (
        {e.id for e in data.evidence}
        | {e.id for e in data.events}
        | {c.id for c in data.claims}
        | {c.id for c in data.conflicts}
        | {h.id for h in data.hypotheses}
        | {q.id for q in data.questions}
    )


def keep_cited(points: list[dict], known: set[str]) -> tuple[list[dict], int]:
    """Keep points whose citations all exist and are not empty. Returns (kept, dropped count)."""
    kept = [p for p in points if p.get("cites") and all(c in known for c in p["cites"])]
    return kept, len(points) - len(kept)


# --- reading a document ---------------------------------------------------------------------


def _docx_text(raw: bytes) -> str:
    with zipfile.ZipFile(BytesIO(raw)) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="replace")
    paragraphs = re.findall(r"<w:p[ >].*?</w:p>", xml, flags=re.S)
    texts = ["".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, flags=re.S)) for p in paragraphs]
    return "\n".join(f"[para {i}] {t}" for i, t in enumerate((t for t in texts if t.strip()), 1))


def _pdf_text(raw: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:  # noqa: BLE001 - a PDF we cannot read only loses quote checking
        return ""


def _squash(text: str) -> str:
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip().lower()


def quote_found(quote: str, document_text: str) -> bool:
    q = _squash(quote)
    return len(q) >= 8 and q in _squash(document_text)


def document_content(item: EvidenceItem, raw: bytes) -> tuple[list[dict], str | None]:
    """Content blocks for the model, plus the plain text used to check quotes (None for images)."""
    ext = item.original_filename.rsplit(".", 1)[-1].lower()
    if item.type is EvidenceType.PDF:
        if len(raw) > MAX_PDF_BYTES:
            raise ApiError(413, "too_large_for_ai", "PDFs over 30 MB cannot be read by the AI.")
        block = {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": base64.standard_b64encode(raw).decode(),
            },
        }
        return [block], _pdf_text(raw)
    if item.type is EvidenceType.IMAGE:
        media = _IMAGE_TYPES.get(ext)
        if media is None:
            raise ApiError(
                415,
                "image_type_not_readable",
                f".{ext} photos cannot be read by the AI. "
                "Export as JPEG or PNG, or add events by hand.",
            )
        block = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media,
                "data": base64.standard_b64encode(raw).decode(),
            },
        }
        return [block], None
    if item.type is EvidenceType.DOCUMENT and ext == "docx":
        text = _docx_text(raw)
    elif item.type in {EvidenceType.TEXT, EvidenceType.CSV, EvidenceType.JSON}:
        lines = raw.decode("utf-8-sig", errors="replace").splitlines()
        text = "\n".join(f"[line {i}] {line}" for i, line in enumerate(lines, 1))
    else:
        raise ApiError(
            415,
            "not_readable_by_ai",
            f"{item.type.value} files are not read by the AI. Log observations on audio and video.",
        )
    if len(text) > MAX_TEXT_CHARS:
        raise ApiError(413, "too_large_for_ai", "This document is too long for one AI request.")
    return [{"type": "text", "text": f"<document>\n{text}\n</document>"}], text


_EVENTS_SCHEMA = _obj(
    {
        "events": {
            "type": "array",
            "items": _obj(
                {
                    "locator": _STR,
                    "quote": _STR,
                    "description": _STR,
                    "proposed_time": _STR,
                    "approximate_seconds": {"type": "integer"},
                    "date_assumed": {"type": "boolean"},
                }
            ),
        }
    }
)


def suggest_events(
    data: CaseData, item: EvidenceItem, path: Path
) -> tuple[list[dict], str | None, str]:
    """Ask the AI for events stated in one document. Returns (events, document text, model)."""
    content, text = document_content(item, path.read_bytes())
    c = data.case
    name = item.original_filename
    instruction = f"""Read the evidence above ({item.id}, "{name}") for case {c.id}.
The incident window is {c.incident_start} to {c.incident_end}.

List every event the document itself states happened at a time: arrivals, departures, doors,
alarms, scans, calls, sightings. For each give:
- locator: where it is (page and paragraph, line, or "image").
- quote: the exact words from the document, copied character for character (for an image,
  describe only what is visibly shown).
- description: one short neutral sentence. No names unless the document names them; no blame.
- proposed_time: ISO 8601 with UTC offset. If the document gives a clock time but no date, use
  the incident window's date and offset and set date_assumed true. If it gives no time, use "".
- approximate_seconds: how far off the time could be when the document hedges ("about",
  "around", "maybe"); 0 when it is exact.

Do not infer events that are not stated. If there are none, return an empty list."""
    out, model = _call(RULES, content + [{"type": "text", "text": instruction}], _EVENTS_SCHEMA)
    return list(out.get("events", []))[:50], text, model


_BRIEFING_SCHEMA = _obj(
    {
        "summary": {"type": "array", "items": _POINT},
        "key_facts": {"type": "array", "items": _POINT},
        "open_questions": {"type": "array", "items": _POINT},
        "next_steps": {"type": "array", "items": _STR},
    }
)


def briefing(data: CaseData) -> tuple[dict, int, str]:
    """A compiled overview. Returns (sections, points dropped, model)."""
    prompt = f"""<case_data>
{case_context(data)}
</case_data>

Write a briefing an investigator can read in two minutes:
- summary: 3-5 points on what the records show so far, in time order.
- key_facts: the facts best supported by the records (supported claims and events).
- open_questions: what the records cannot settle yet, including open conflicts
  and unresolved claims.
- next_steps: up to 5 concrete actions that would close gaps (more evidence,
  a clock check, a decision).
Every point in the first three lists must cite at least one record ID."""
    out, model = _call(RULES, [{"type": "text", "text": prompt}], _BRIEFING_SCHEMA)
    known = _known(data)
    dropped = 0
    for key in ("summary", "key_facts", "open_questions"):
        out[key], n = keep_cited(out.get(key, []), known)
        dropped += n
    out["next_steps"] = [s for s in out.get("next_steps", []) if s.strip()][:5]
    return out, dropped, model


_ANSWER_SCHEMA = _obj({"can_answer": {"type": "boolean"}, "answer": _STR, "cites": _CITES})


def ask(data: CaseData, question: str) -> tuple[dict, int, str]:
    prompt = f"""<case_data>
{case_context(data)}
</case_data>

Question from the investigator: <question>{question}</question>

Answer only from the case data. Set can_answer false and explain what is missing when the
records do not settle it. Cite every record you rely on."""
    out, model = _call(RULES, [{"type": "text", "text": prompt}], _ANSWER_SCHEMA, effort="low")
    known = _known(data)
    cites = [c for c in out.get("cites", []) if c in known]
    removed = len(out.get("cites", [])) - len(cites)
    can = bool(out.get("can_answer")) and bool(cites)
    answer = out.get("answer", "").strip()
    if out.get("can_answer") and not cites:
        answer = "The records do not support a cited answer. " + answer
    return {"can_answer": can, "answer": answer, "cites": cites}, removed, model


_DRAFT_SCHEMA = _obj(
    {
        "finding": {
            "type": "string",
            "enum": ["established", "partly_established", "not_established"],
        },
        "text": _STR,
        "cites": _CITES,
    }
)


def draft_answer(data: CaseData, question_id: str) -> tuple[dict, int, str]:
    question = next((q for q in data.questions if q.id == question_id), None)
    if question is None:
        raise ApiError(404, "not_found", f"{question_id} is not a question in this case.")
    prompt = f"""<case_data>
{case_context(data)}
</case_data>

Draft an answer to {question.id}: "{question.text}"
- finding: established only if a supported claim answers it; partly_established if the records
  point one way without settling it; not_established if they cannot answer it.
- text: 2-4 plain sentences a reviewer can edit. State what remains unresolved.
- cites: the records the answer rests on."""
    out, model = _call(RULES, [{"type": "text", "text": prompt}], _DRAFT_SCHEMA)
    known = _known(data)
    cites = [c for c in out.get("cites", []) if c in known]
    return {**out, "cites": cites}, len(out.get("cites", [])) - len(cites), model
