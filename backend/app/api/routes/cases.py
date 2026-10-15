from fastapi import APIRouter

from app.errors import ApiError, not_found
from app.models.domain import (
    AuditEvent,
    CaseCreate,
    CaseSummary,
    Claim,
    Conflict,
    Event,
    EvidenceItem,
    Hypothesis,
    OriginalRecord,
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


@router.post("/cases", response_model=CaseSummary, status_code=201)
def create_case(body: CaseCreate) -> CaseSummary:
    data = store.create_case(
        body.title.strip(),
        body.description.strip(),
        body.incident_start.isoformat(),
        body.incident_end.isoformat(),
        scope=body.scope.strip(),
        classification=body.classification,
    )
    return data.summary()


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


@router.get("/cases/{case_id}/evidence/{evidence_id}/original", response_model=OriginalRecord)
def read_original(case_id: str, evidence_id: str) -> OriginalRecord:
    data = get_case(case_id)
    item = next((e for e in data.evidence if e.id == evidence_id), None)
    if item is None:
        raise not_found("evidence", evidence_id)
    original = data.original_rows(evidence_id)
    if original is None:
        raise ApiError(
            404,
            "original_not_available",
            f"No original file is stored for {evidence_id}; its events come from seed metadata.",
        )
    filename, columns, rows = original
    return OriginalRecord(
        evidence_id=evidence_id, filename=filename, sha256=item.sha256, columns=columns, rows=rows
    )


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
