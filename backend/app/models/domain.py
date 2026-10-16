"""Shared domain contract.

Every route, service and teammate module exchanges these models. Changing a field here is a
contract change: discuss it in an issue with the lead before opening a pull request.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import AwareDatetime, BaseModel, Field, model_validator


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
    DOCUMENT = "document"


class ExtractionMethod(StrEnum):
    CSV_PARSER = "deterministic_csv_parser"
    LOG_PARSER = "deterministic_log_parser"
    MANUAL = "manual_observation"
    AI_ACCEPTED = "ai_suggested_human_accepted"
    NONE = "not_extracted"
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


class DataClassification(StrEnum):
    SYNTHETIC = "synthetic"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"


class Case(BaseModel):
    id: str
    title: str
    description: str
    incident_start: str
    incident_end: str
    status: str
    fictional: bool = True
    scope: str = Field(default="", description="What the case tries to establish, and what not")
    classification: DataClassification = DataClassification.SYNTHETIC


class ClockAssumption(BaseModel):
    """How a source's clock relates to the reference clock.

    offset_seconds > 0 means the source clock runs fast, so normalized = source - offset.
    """

    offset_seconds: int = 0
    method: str = "reference_clock"
    note: str = ""
    # For method "infer_from_anchors": this source's event ID -> the reference event it records.
    anchors: dict[str, str] = Field(default_factory=dict)
    spread_seconds: int = 0


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
    recorded_at: str | None = Field(
        default=None, description="Start time stored in the media file itself; not verified"
    )
    extraction_note: str = Field(default="", description="What extraction did, in one line")


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
    extracted_by: str | None = Field(
        default=None, description="Who added it: a person's name for observations and accepted AI"
    )


class ReviewNote(BaseModel):
    """A human decision or note. Never edited after it is recorded."""

    actor: str
    at: str
    note: str
    status: ReviewStatus | None = None


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
    reviews: list[ReviewNote] = Field(default_factory=list)


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
    question_id: str | None = Field(default=None, description="The case question it bears on")
    created_by: str | None = None


class Hypothesis(BaseModel):
    id: str
    case_id: str
    conflict_id: str | None = Field(default=None, description="Conflict this hypothesis explains")
    question: str
    description: str
    state: ClaimState
    notes: str
    links: list[EvidenceLink] = Field(default_factory=list)
    reviews: list[ReviewNote] = Field(default_factory=list)


class AuditEvent(BaseModel):
    id: str
    case_id: str
    at: str
    actor: str
    action: str
    entity_ref: str
    details: str


class OriginalRecord(BaseModel):
    """Read-only copy of an original log file, exactly as ingested."""

    evidence_id: str
    filename: str
    sha256: str | None
    columns: list[str]
    rows: list[dict[str, str]]


class CaseCreate(BaseModel):
    """Input for a new, empty investigation."""

    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=1000)
    scope: str = Field(default="", max_length=500)
    classification: DataClassification = DataClassification.SYNTHETIC
    incident_start: AwareDatetime
    incident_end: AwareDatetime

    @model_validator(mode="after")
    def _window_in_order(self) -> CaseCreate:
        if self.incident_end <= self.incident_start:
            raise ValueError("incident_end must be after incident_start")
        return self


class ReviewCreate(BaseModel):
    """A reviewer decision on a conflict (with optional status) or a note on a hypothesis."""

    target_id: str = Field(pattern=r"^(C|H)-\d{2}$")
    note: str = Field(min_length=5, max_length=500)
    status: ReviewStatus | None = None
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class StagedItem(BaseModel):
    evidence_id: str
    source_name: str
    summary: str


class ChangeSummary(BaseModel):
    """What adding evidence changed, and what it did not."""

    id: str
    case_id: str
    at: str
    trigger: str
    added_evidence: list[str]
    added_events: list[str]
    added_claims: list[str]
    conflicts_added: list[str]
    conflicts_removed: list[str]
    state_changes: list[str]
    unchanged: list[str]


class CaseSummary(BaseModel):
    case: Case
    evidence_count: int
    event_count: int
    open_conflicts: int


class ObservationCreate(BaseModel):
    """Something an investigator saw or heard at a point in a recording."""

    timecode: str = Field(pattern=r"^\d{1,2}:\d{2}(:\d{2})?$")
    description: str = Field(min_length=3, max_length=300)
    source_time: AwareDatetime | None = Field(
        default=None, description="Needed when the file holds no start time"
    )
    interpretation: bool = Field(default=False, description="True when it is a reading, not a fact")
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class ClockUpdate(BaseModel):
    """How a source's clock relates to the reference clock, set by an investigator."""

    method: str = Field(pattern="^(reference_clock|declared|anchors)$")
    offset_seconds: int = Field(default=0, ge=-86_400, le=86_400)
    anchors: dict[str, str] = Field(default_factory=dict, max_length=20)
    note: str = Field(default="", max_length=300)
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class Question(BaseModel):
    """Something the case must establish. Conclusions answer questions, not claims."""

    id: str
    case_id: str
    text: str
    created_by: str
    created_at: str


class QuestionCreate(BaseModel):
    text: str = Field(min_length=5, max_length=300)
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class ClaimCreate(BaseModel):
    """A statement an investigator puts forward, with the evidence it rests on."""

    statement: str = Field(min_length=5, max_length=300)
    question_id: str | None = Field(default=None, pattern=r"^Q-\d{2}$")
    state: ClaimState
    rationale: str = Field(min_length=5, max_length=500)
    links: list[EvidenceLink] = Field(default_factory=list, max_length=20)
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class Finding(StrEnum):
    ESTABLISHED = "established"
    PARTLY = "partly_established"
    NOT_ESTABLISHED = "not_established"


class Answer(BaseModel):
    question_id: str = Field(pattern=r"^Q-\d{2}$")
    finding: Finding
    text: str = Field(min_length=20, max_length=2000)
    cites: list[str] = Field(default_factory=list, max_length=40)


class ConclusionCreate(BaseModel):
    """A signed answer to every question. Signing needs both attestations."""

    answers: list[Answer] = Field(min_length=1, max_length=30)
    actor: str = Field(min_length=2, max_length=40)
    role: str = Field(default="investigator", pattern="^(investigator|reviewer)$")
    attest_sources_reviewed: bool
    attest_unresolved_stated: bool


class Conclusion(BaseModel):
    id: str
    case_id: str
    version: int
    answers: list[Answer]
    signed_by: str
    role: str
    signed_at: str
    supersedes: str | None = None


class JourneyStep(BaseModel):
    key: str
    label: str
    done: bool
    detail: str
    href: str


class Journey(BaseModel):
    case_id: str
    steps: list[JourneyStep]
    current: str
    next_label: str
    next_detail: str
    next_href: str


# --- AI assistance: suggestions and drafts that a person accepts or rejects ---------------------


class Suggestion(BaseModel):
    """An event the AI read in a document. Not evidence until a person accepts it."""

    id: str
    case_id: str
    evidence_id: str
    locator: str
    quote: str
    description: str
    proposed_time: str | None = None
    approximate_seconds: int = 0
    date_assumed: bool = False
    quote_verified: bool | None = Field(
        default=None, description="Quote found word for word in the document text; null for images"
    )
    status: str = "pending"
    model: str
    created_at: str
    decided_by: str | None = None
    decided_at: str | None = None
    reason: str = ""
    event_id: str | None = None


class SuggestionDecision(BaseModel):
    action: str = Field(pattern="^(accept|reject)$")
    description: str | None = Field(default=None, min_length=3, max_length=300)
    proposed_time: AwareDatetime | None = None
    reason: str = Field(default="", max_length=300)
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class CitedPoint(BaseModel):
    text: str
    cites: list[str]


class Briefing(BaseModel):
    """A compiled overview written by the AI from the case's own records, every point cited."""

    id: str
    case_id: str
    model: str
    created_at: str
    created_by: str
    summary: list[CitedPoint]
    key_facts: list[CitedPoint]
    open_questions: list[CitedPoint]
    next_steps: list[str]
    removed: int = Field(default=0, description="Points dropped because a citation did not exist")


class AiRequest(BaseModel):
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class AskAnswer(BaseModel):
    question: str
    can_answer: bool
    answer: str
    cites: list[str]
    removed: int = 0
    model: str
    created_at: str


class DraftRequest(BaseModel):
    question_id: str = Field(pattern=r"^Q-\d{2}$")
    actor: str = Field(default="BJ", min_length=1, max_length=40)


class Draft(BaseModel):
    """Suggested wording for one answer. A starting point; it is never signed as is."""

    question_id: str
    finding: Finding
    text: str
    cites: list[str]
    removed: int = 0
    model: str


class AiStatus(BaseModel):
    configured: bool
    model: str
