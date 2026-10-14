"""Report export — owned by @Riel101 (issue: Report export).

HTTP concerns only: validate the requested format, build the document in app/report/, and
return it as a file download. The report content itself lives in app/report/.
"""

import json

from fastapi import APIRouter, Response

from app.api.routes.cases import get_case
from app.errors import ApiError
from app.report import build_report, render_markdown

router = APIRouter(prefix="/api", tags=["report"])

_MEDIA_TYPES = {
    "md": "text/markdown; charset=utf-8",
    "json": "application/json",
}
_FORMATS = tuple(_MEDIA_TYPES)


@router.get("/cases/{case_id}/report")
def report(case_id: str, format: str = "md") -> Response:
    """Download the investigation report for a case as Markdown (`md`) or JSON (`json`)."""
    data = get_case(case_id)  # raises the shared 404 shape for an unknown case

    if format not in _FORMATS:
        raise ApiError(
            422,
            "unsupported_format",
            f"Unsupported report format '{format}'. Use 'md' or 'json'.",
            {"format": format, "allowed": list(_FORMATS)},
        )

    document = build_report(data)
    if format == "json":
        body = json.dumps(document, indent=2, ensure_ascii=False)
    else:
        body = render_markdown(document)

    filename = f"{case_id}-report.{format}"
    return Response(
        content=body,
        media_type=_MEDIA_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
