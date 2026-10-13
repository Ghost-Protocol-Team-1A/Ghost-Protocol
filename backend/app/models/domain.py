"""Shared domain contract.

Every route, service and teammate module exchanges these models. Changing a field here is a
contract change: discuss it in an issue with the lead before opening a pull request.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class ClaimState(StrEnum):
    SUPPORTED = "supported"
    CONTRADICTED = "contradicted"
    INFERRED = "inferred"
    UNRESOLVED = "unresolved"


class EvidenceType(StrEnum):
    VIDEO = "video"
    AUDIO = "audio"
    CSV = "csv"
    JSON = "json"
    PDF = "pdf"
    TEXT = "text"
    IMAGE = "image"


class ExtractionMethod(StrEnum):
    CSV_PARSER = "deterministic_csv_parser"
    SIMULATED = "simulated_from_seed_metadata"


class ProcessingStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    FAILED = "failed"


class ConflictType(StrEnum):
    COPIED_RECORD = "copied_record"
    CLOCK_OFFSET = "clock_offset"
    IDENTITY_NOT_ESTABLISHED = "identity_not_established"


class Severity(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    REVIEW = "review"


class ReviewStatus(StrEnum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class Case(BaseModel):
    id: str
    title: str
    description: str
    incident_start: str
    incident_end: str
    status: str
    fictional: bool = True


class ClockAssumption(BaseModel):
    """How a source's clock relates to the reference clock.

    offset_seconds > 0 means the source clock runs fast, so normalized = source - offset.
    """

    offset_seconds: int = 0
    method: str = "reference_clock"
    note: str = ""


class EvidenceItem(BaseModel):
    id: str
    case_id: str
    type: EvidenceType
    source_name: str
    original_filename: str
    sha256: str | None = Field(
        default=None, description="SHA-256 of the original bytes; null when no file exists"
    )
    size_bytes: int | None = None
    ingested_at: str
    processing_status: ProcessingStatus
    extraction_method: ExtractionMethod
    clock: ClockAssumption
    simulated: bool = Field(description="True when events come from seed metadata, not parsing")


class Event(BaseModel):
    id: str
    case_id: str
    evidence_id: str
    locator: str = Field(description="Exact place in the source: row, timecode, page/para")
    description: str
    source_time: str | None = Field(description="Timestamp exactly as recorded; never changed")
    normalized_time: str | None = Field(description="UTC ISO-8601; null if it cannot be derived")
    offset_seconds: int = 0
    normalization_rule: str
    approximate: bool = False
    uncertainty_seconds: int = 0
    state: ClaimState
    record: dict[str, str] = Field(default_factory=dict, description="Parsed fields for log rows")


class Conflict(BaseModel):
    id: str
    case_id: str
    type: ConflictType
    rule_id: str
    severity: Severity
    evidence_ids: list[str]
    event_ids: list[str]
    explanation: str
    detection_method: str
    uncertain: str = Field(description="What the rule cannot tell us")
    status: ReviewStatus = ReviewStatus.OPEN
    requires_human_review: bool = True


class EvidenceLink(BaseModel):
    evidence_id: str
    locator: str | None = None
    relationship: str = Field(pattern="^(supports|contradicts)$")


class Claim(BaseModel):
    id: str
    case_id: str
    statement: str
    kind: str = "event"
    state: ClaimState
    rationale: str
    links: list[EvidenceLink] = Field(default_factory=list)
    origin: str = "seed_analyst"


class Hypothesis(BaseModel):
    id: str
    case_id: str
    conflict_id: str | None = Field(default=None, description="Conflict this hypothesis explains")
    question: str
    description: str
    state: ClaimState
    notes: str
    links: list[EvidenceLink] = Field(default_factory=list)


class AuditEvent(BaseModel):
    id: str
    case_id: str
    at: str
    actor: str
    action: str
    entity_ref: str
    details: str


class CaseSummary(BaseModel):
    case: Case
    evidence_count: int
    event_count: int
    open_conflicts: int
