"""Evidence upload route.

The validation and hashing it relies on are owned by @mallison031 in app/storage/. The lead
wires the result into the case store once those functions are implemented.
"""

from fastapi import APIRouter, UploadFile

from app.api.routes.cases import get_case
from app.errors import ApiError

router = APIRouter(prefix="/api", tags=["evidence"])


@router.post("/cases/{case_id}/evidence", status_code=201)
async def upload_evidence(case_id: str, file: UploadFile) -> None:
    get_case(case_id)
    raise ApiError(501, "not_implemented", "Evidence upload is not implemented yet.")
