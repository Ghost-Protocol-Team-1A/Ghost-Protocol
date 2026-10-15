"""Reviewer decisions: conflict status changes and notes, hypothesis notes."""

from fastapi import APIRouter

from app.api.routes.cases import get_case
from app.errors import ApiError, not_found
from app.models.domain import Conflict, Hypothesis, ReviewCreate
from app.services.store import store

router = APIRouter(prefix="/api", tags=["reviews"])


@router.post("/cases/{case_id}/reviews", response_model=Conflict | Hypothesis, status_code=201)
def create_review(case_id: str, body: ReviewCreate) -> Conflict | Hypothesis:
    data = get_case(case_id)
    try:
        target = data.review(body, store.now())
    except LookupError:
        raise not_found("review target", body.target_id) from None
    except ValueError as exc:
        raise ApiError(422, "invalid_review", str(exc)) from None
    decision = f"status → {body.status.value}; " if body.status else ""
    store.record(case_id, body.actor, "Review recorded", body.target_id, f"{decision}{body.note}")
    return target
