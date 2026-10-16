"""Data export for BI tools: tidy tables as an Excel workbook or a zip of CSVs."""

from fastapi import APIRouter, Response

from app.api.routes.cases import get_case
from app.errors import ApiError
from app.services import export
from app.services.store import store

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/cases/{case_id}/export")
def export_case(case_id: str, format: str = "xlsx") -> Response:
    """Tidy tables for Power BI, Tableau or Excel: an .xlsx workbook, or a .zip of CSVs."""
    data = get_case(case_id)
    if format == "xlsx":
        body = export.workbook(data)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif format == "zip":
        body, media = export.csv_zip(data), "application/zip"
    else:
        raise ApiError(422, "invalid_format", "Use format=xlsx or format=zip.")
    store.record(case_id, "API", "Data exported", case_id, f"{format} for BI tools")
    return Response(
        body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{case_id}-data.{format}"'},
    )
