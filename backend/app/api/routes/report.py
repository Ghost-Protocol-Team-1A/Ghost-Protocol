"""Report export — owned by @Riel101 (issue: Report export).

Replace the placeholder below with the real implementation. Build the content in
app/report/ and keep this module to HTTP concerns only.
"""

from fastapi import APIRouter

from app.api.routes.cases import get_case
from app.errors import ApiError

router = APIRouter(prefix="/api", tags=["report"])


@router.get("/cases/{case_id}/report")
def report(case_id: str, format: str = "md") -> None:
    get_case(case_id)  # 404 for unknown cases
    raise ApiError(501, "not_implemented", "Report export is not implemented yet.")
