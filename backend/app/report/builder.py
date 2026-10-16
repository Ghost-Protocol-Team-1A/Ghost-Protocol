"""Build the investigation report as a deterministic, serialisable structure.

The report is derived from the live case data on every call, never from a stored copy, so it
always reflects the current state of the case. Everything except ``generated_at`` depends only
on the case inputs, so two calls produce identical output apart from that one timestamp.

The structure is format-agnostic: :mod:`app.report.markdown` renders it as Markdown and the HTTP
route serialises it as JSON. Section order matches Figma frame 48:413 (Report builder).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

from app.models.domain import Case, ClaimState
from app.services.store import CaseData

# Fixed notice shown at the top of every report. Do not reword: it is a product rule.
NOTICE = (
    "Investigative aid only. This report does not determine responsibility or guilt. "
    "All data is fictional."
)

MODEL_VERSION = "1.0"

METHODS_AND_LIMITATIONS = [
    "Source times are never overwritten. Each event keeps the timestamp exactly as recorded "
    "next to its normalized time and the rule that produced it.",
    "Log files (CSV) are parsed deterministically; extraction for video, audio and PDF is "
    "simulated in this demo and is labelled as such.",
    "In this demo the E-02 clock offset is declared in the fixture metadata, not inferred from "
    "the evidence.",
    "Conflicts come from deterministic rules with stable IDs. A conflict is a prompt for human "
    "review, not proof of tampering.",
    "Every claim keeps its state (supported, contradicted, inferred or unresolved); the report "
    "does not drop uncertainty to make the timeline look cleaner.",
    "Hypotheses carry no probability score. The system compares evidence; it does not pick a "
    "winner.",
    "Results on a small synthetic case say nothing about accuracy on real investigations.",
]


def utc_now() -> str:
    """Current time as UTC ISO-8601, matching the rest of the API (`Z` suffix)."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _site_offset_minutes(case: Case) -> int:
    """Offset of the incident site clock, read from the incident window (e.g. +01:00 → 60)."""
    parsed = datetime.fromisoformat(case.incident_start)
    offset = parsed.utcoffset()
    return int(offset.total_seconds()) // 60 if offset is not None else 0


def _clock(value: str | None, offset_minutes: int) -> str:
    """Render a timestamp as site-local HH:MM:SS; pass raw text through when unparseable."""
    if not value:
        return "—"
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return value
    if parsed.tzinfo is None:
        return value
    local = parsed.astimezone(timezone(timedelta(minutes=offset_minutes)))
    return local.strftime("%H:%M:%S")


def _window(case: Case, offset_minutes: int) -> str:
    tz = timezone(timedelta(minutes=offset_minutes))
    start = datetime.fromisoformat(case.incident_start).astimezone(tz)
    end = datetime.fromisoformat(case.incident_end).astimezone(tz)
    zone = start.strftime("%z")
    zone = f"{zone[:3]}:{zone[3:]}" if zone else "UTC"
    return (
        f"{start.strftime('%Y-%m-%d %H:%M:%S')} – {end.strftime('%H:%M:%S')} site time (UTC{zone})"
    )


def _scope_section(case: Case, offset_minutes: int) -> dict:
    return {
        "id": "scope",
        "title": "Scope and case context",
        "type": "facts",
        "facts": [
            {"label": "Case", "value": f"{case.id} · {case.title}"},
            {"label": "Summary", "value": case.description},
            {"label": "Incident window", "value": _window(case, offset_minutes)},
            {"label": "Status", "value": case.status},
            {"label": "Data", "value": "Fictional demo case" if case.fictional else "Live case"},
        ],
    }


def _evidence_section(data: CaseData) -> dict:
    rows = [
        [item.id, item.source_name, item.type.value, item.sha256 or "No file", item.ingested_at]
        for item in data.evidence
    ]
    return {
        "id": "evidence",
        "title": "Evidence inventory",
        "type": "table",
        "columns": ["ID", "Item", "Type", "SHA-256", "Ingested at"],
        "rows": rows,
    }


def _timeline_section(data: CaseData, offset_minutes: int) -> dict:
    rows = []
    for event in data.events:
        source = _clock(event.source_time, offset_minutes)
        normalized = _clock(event.normalized_time, offset_minutes)
        if event.approximate:
            source = f"~{source}"
            normalized = f"~{normalized}"
        rows.append(
            [
                event.id,
                f"{source} → {normalized}",
                event.normalization_rule or "none",
                event.state.value,
                f"{event.evidence_id} · {event.locator}",
            ]
        )
    return {
        "id": "timeline",
        "title": "Reconstructed timeline",
        "type": "table",
        "columns": [
            "Event",
            "Source time → Normalized time",
            "Rule applied",
            "Claim state",
            "Source locator",
        ],
        "rows": rows,
    }


def _conflicts_section(data: CaseData) -> dict:
    items = [
        {
            "id": conflict.id,
            "rule_id": conflict.rule_id,
            "type": conflict.type.value,
            "severity": conflict.severity.value,
            "evidence": ", ".join(conflict.evidence_ids) or "—",
            "explanation": conflict.explanation,
            "uncertain": conflict.uncertain,
        }
        for conflict in data.conflicts
    ]
    return {
        "id": "conflicts",
        "title": "Conflicts and rules",
        "type": "items",
        "items": items,
    }


def _hypotheses_section(data: CaseData) -> dict:
    items = [
        {
            "id": hypothesis.id,
            "question": hypothesis.question,
            "description": hypothesis.description,
            "state": hypothesis.state.value,
            "notes": hypothesis.notes,
        }
        for hypothesis in data.hypotheses
    ]
    return {
        "id": "hypotheses",
        "title": "Alternative hypotheses",
        "type": "items",
        "items": items,
    }


def _unresolved_section(data: CaseData) -> dict:
    items = [
        {
            "id": claim.id,
            "statement": claim.statement,
            "state": claim.state.value,
            "rationale": claim.rationale,
        }
        for claim in data.claims
        if claim.state is ClaimState.UNRESOLVED
    ]
    return {
        "id": "unresolved",
        "title": "Unresolved questions",
        "type": "items",
        "items": items,
    }


def _methods_section() -> dict:
    return {
        "id": "methods",
        "title": "Methods and limitations",
        "type": "points",
        "points": list(METHODS_AND_LIMITATIONS),
    }


def _claims_section(data: CaseData) -> dict:
    """Appendix listing every claim with its state, so no claim is dropped from the report."""
    items = [
        {
            "id": claim.id,
            "statement": claim.statement,
            "state": claim.state.value,
            "rationale": claim.rationale,
            "citations": [
                f"{link.evidence_id} ({link.relationship})"
                + (f" · {link.locator}" if link.locator else "")
                for link in claim.links
            ]
            or ["No citation"],
        }
        for claim in data.claims
    ]
    return {
        "id": "claims",
        "title": "Appendix: Claims assessed",
        "type": "items",
        "items": items,
    }


_FINDING_LABELS = {
    "established": "Established",
    "partly_established": "Partly established",
    "not_established": "Not established",
}


def _questions_section(data: CaseData) -> dict:
    """Each question with the claims that bear on it and, once signed, its finding."""
    signed = data.conclusions[-1] if data.conclusions else None
    answers = {a.question_id: a for a in signed.answers} if signed else {}
    items = []
    for question in data.questions:
        claims = [c for c in data.claims if c.question_id == question.id]
        answer = answers.get(question.id)
        items.append(
            {
                "id": question.id,
                "question": question.text,
                "claims": [f"{c.id} ({c.state.value}) {c.statement}" for c in claims]
                or ["No claim yet"],
                "finding": _FINDING_LABELS[answer.finding.value] if answer else "Not answered",
                "answer": answer.text if answer else "—",
                "cites": answer.cites if answer else [],
            }
        )
    return {"id": "findings", "title": "Questions and findings", "type": "items", "items": items}


def _signoff_section(data: CaseData) -> dict:
    signed = data.conclusions[-1] if data.conclusions else None
    if signed is None:
        facts = [
            {"label": "Status", "value": "Not signed. This report is a working draft."},
        ]
    else:
        facts = [
            {"label": "Signed by", "value": f"{signed.signed_by} ({signed.role})"},
            {"label": "Signed at", "value": signed.signed_at},
            {
                "label": "Version",
                "value": f"{signed.version}"
                + (f", supersedes {signed.supersedes}" if signed.supersedes else ""),
            },
            {
                "label": "Attested",
                "value": "Every cited source and open conflict was reviewed; "
                "unresolved points are stated as unresolved.",
            },
        ]
    return {"id": "signoff", "title": "Sign-off", "type": "facts", "facts": facts}


def build_report(data: CaseData, generated_at: str | None = None) -> dict:
    """Build the full report structure for a case.

    ``generated_at`` defaults to now in UTC; pass a fixed value to make output reproducible in
    tests. Every other field is derived only from the case data.
    """
    offset_minutes = _site_offset_minutes(data.case)
    return {
        "model_version": MODEL_VERSION,
        "title": f"Investigation report · {data.case.id}",
        "case_id": data.case.id,
        "generated_at": generated_at or utc_now(),
        "notice": NOTICE,
        "sections": [
            _scope_section(data.case, offset_minutes),
            _evidence_section(data),
            _timeline_section(data, offset_minutes),
            _conflicts_section(data),
            _hypotheses_section(data),
            _unresolved_section(data),
            _methods_section(),
            _claims_section(data),
            _questions_section(data),
            _signoff_section(data),
        ],
    }
