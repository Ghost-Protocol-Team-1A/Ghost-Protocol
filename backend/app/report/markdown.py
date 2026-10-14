"""Render a report structure (see :mod:`app.report.builder`) as Markdown."""

from __future__ import annotations

# Friendlier labels for the structured item fields, keyed by the field name in the report.
_FIELD_LABELS = {
    "rule_id": "Rule",
    "type": "Type",
    "severity": "Severity",
    "evidence": "Evidence involved",
    "explanation": "Explanation",
    "uncertain": "What the rule cannot tell us",
    "question": "Question",
    "description": "Hypothesis",
    "state": "State",
    "notes": "Notes",
    "statement": "Statement",
    "rationale": "Rationale",
    "citations": "Citations",
}


def _cell(value: object) -> str:
    """Make a value safe inside a Markdown table cell."""
    text = str(value)
    return text.replace("|", "\\|").replace("\n", " ").strip()


def _facts(facts: list[dict]) -> str:
    return "\n".join(f"- **{fact['label']}:** {fact['value']}" for fact in facts)


def _table(columns: list[str], rows: list[list[object]]) -> str:
    header = "| " + " | ".join(_cell(c) for c in columns) + " |"
    divider = "| " + " | ".join("---" for _ in columns) + " |"
    body = [
        "| " + " | ".join(_cell(value) for value in row) + " |" for row in rows
    ] or ["| " + " | ".join("—" for _ in columns) + " |"]
    return "\n".join([header, divider, *body])


def _items(items: list[dict]) -> str:
    if not items:
        return "_None._"
    blocks: list[str] = []
    for item in items:
        heading = item.get("id", "Item")
        lines = [f"**{heading}**"]
        for key, value in item.items():
            if key == "id":
                continue
            label = _FIELD_LABELS.get(key, key.replace("_", " ").capitalize())
            if isinstance(value, list):
                rendered = "; ".join(str(v) for v in value) if value else "—"
            else:
                rendered = str(value)
            lines.append(f"- **{label}:** {rendered}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _points(points: list[str]) -> str:
    return "\n".join(f"- {point}" for point in points)


def render_markdown(report: dict) -> str:
    """Render a report structure as a Markdown document."""
    lines: list[str] = [
        f"# {report['title']}",
        "",
        f"_Generated {report['generated_at']} · model {report['model_version']}_",
        "",
        f"> {report['notice']}",
    ]

    for index, section in enumerate(report["sections"], 1):
        lines += ["", f"## {index:02d} {section['title']}", ""]
        section_type = section["type"]
        if section_type == "facts":
            lines.append(_facts(section["facts"]))
        elif section_type == "table":
            lines.append(_table(section["columns"], section["rows"]))
        elif section_type == "items":
            lines.append(_items(section["items"]))
        elif section_type == "points":
            lines.append(_points(section["points"]))
        else:  # pragma: no cover - guarded by the builder
            raise ValueError(f"Unknown report section type: {section_type}")

    return "\n".join(lines).rstrip("\n") + "\n"
