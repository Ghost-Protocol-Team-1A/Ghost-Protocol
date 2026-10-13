from fastapi import APIRouter

from app.errors import not_found
from app.models.domain import (
    AuditEvent,
    CaseSummary,
    Claim,
    Conflict,
    Event,
    EvidenceItem,
    Hypothesis,
)
from app.services.store import CaseData, store

router = APIRouter(prefix="/api", tags=["cases"])


def get_case(case_id: str) -> CaseData:
    data = store.cases.get(case_id)
    if data is None:
        raise not_found("case", case_id)
    return data


@router.get("/cases", response_model=list[CaseSummary])
def list_cases() -> list[CaseSummary]:
    return [d.summary() for d in store.cases.values()]


@router.get("/cases/{case_id}", response_model=CaseSummary)
def read_case(case_id: str) -> CaseSummary:
    return get_case(case_id).summary()


@router.get("/cases/{case_id}/evidence", response_model=list[EvidenceItem])
def list_evidence(case_id: str) -> list[EvidenceItem]:
    return get_case(case_id).evidence


@router.get("/evidence/{evidence_id}", response_model=EvidenceItem)
def read_evidence(evidence_id: str, case_id: str = "CASE-001") -> EvidenceItem:
    for item in get_case(case_id).evidence:
        if item.id == evidence_id:
            return item
    raise not_found("evidence", evidence_id)


@router.get("/cases/{case_id}/timeline", response_model=list[Event])
def timeline(case_id: str) -> list[Event]:
    return get_case(case_id).events


@router.get("/cases/{case_id}/conflicts", response_model=list[Conflict])
def conflicts(case_id: str) -> list[Conflict]:
    return get_case(case_id).conflicts


@router.get("/cases/{case_id}/claims", response_model=list[Claim])
def claims(case_id: str) -> list[Claim]:
    return get_case(case_id).claims


@router.get("/cases/{case_id}/hypotheses", response_model=list[Hypothesis])
def hypotheses(case_id: str) -> list[Hypothesis]:
    return get_case(case_id).hypotheses


@router.get("/cases/{case_id}/audit", response_model=list[AuditEvent])
def audit(case_id: str) -> list[AuditEvent]:
    return sorted(get_case(case_id).audit, key=lambda a: a.at, reverse=True)
