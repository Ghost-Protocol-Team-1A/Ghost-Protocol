"""Live demo moment: add held-back evidence and show what changed."""

from fastapi import APIRouter

from app.api.routes.cases import get_case
from app.errors import ApiError
from app.models.domain import ChangeSummary, StagedItem
from app.services.store import store

router = APIRouter(prefix="/api", tags=["live"])


@router.get("/cases/{case_id}/staged", response_model=list[StagedItem])
def list_staged(case_id: str) -> list[StagedItem]:
    return get_case(case_id).staged()


@router.post("/cases/{case_id}/staged/{evidence_id}", response_model=ChangeSummary, status_code=201)
def add_staged(case_id: str, evidence_id: str) -> ChangeSummary:
    data = get_case(case_id)
    if evidence_id not in {s.evidence_id for s in data.staged()}:
        raise ApiError(
            409,
            "not_staged",
            f"{evidence_id} is not waiting to be added (already added, or unknown).",
        )
    summary = data.add_staged(evidence_id, store.now())
    store.record(case_id, "BJ", "Evidence added live", evidence_id, summary.trigger)
    return summary


@router.get("/cases/{case_id}/changes", response_model=list[ChangeSummary])
def list_changes(case_id: str) -> list[ChangeSummary]:
    return get_case(case_id).changes
