"""Questions, claims, the signed conclusion and the case journey."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.cases import get_case
from app.models.domain import (
    Claim,
    ClaimCreate,
    Conclusion,
    ConclusionCreate,
    Journey,
    Question,
    QuestionCreate,
)
from app.services import findings
from app.services.store import store

router = APIRouter(prefix="/api", tags=["findings"])


@router.get("/cases/{case_id}/questions", response_model=list[Question])
def list_questions(case_id: str) -> list[Question]:
    return get_case(case_id).questions


@router.post("/cases/{case_id}/questions", response_model=Question, status_code=201)
def add_question(case_id: str, body: QuestionCreate) -> Question:
    question = findings.add_question(get_case(case_id), body, store.now())
    store.record(case_id, body.actor, "Question added", question.id, question.text)
    return question


@router.post("/cases/{case_id}/claims", response_model=Claim, status_code=201)
def add_claim(case_id: str, body: ClaimCreate) -> Claim:
    claim = findings.add_claim(get_case(case_id), body)
    store.record(
        case_id, body.actor, "Claim added", claim.id, f"{claim.state.value}: {claim.statement}"
    )
    return claim


@router.get("/cases/{case_id}/conclusions", response_model=list[Conclusion])
def list_conclusions(case_id: str) -> list[Conclusion]:
    return get_case(case_id).conclusions


@router.post("/cases/{case_id}/conclusions", response_model=Conclusion, status_code=201)
def sign_conclusion(case_id: str, body: ConclusionCreate) -> Conclusion:
    conclusion = findings.sign_conclusion(get_case(case_id), body, store.now())
    store.record(
        case_id,
        body.actor,
        "Conclusion signed",
        conclusion.id,
        f"v{conclusion.version} · {len(conclusion.answers)} answers · {body.role}",
    )
    return conclusion


@router.get("/cases/{case_id}/journey", response_model=Journey)
def read_journey(case_id: str) -> Journey:
    return findings.journey(get_case(case_id))
