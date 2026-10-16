// Mirrors backend/app/models/domain.py. Keep the two in sync; contract changes go through the lead.

export type ClaimState = "supported" | "contradicted" | "inferred" | "unresolved";

export type DataClassification = "synthetic" | "internal" | "confidential";

export interface Case {
  id: string;
  title: string;
  description: string;
  incident_start: string;
  incident_end: string;
  status: string;
  fictional: boolean;
  scope: string;
  classification: DataClassification;
}

export interface NewCase {
  title: string;
  description: string;
  scope: string;
  classification: DataClassification;
  incident_start: string;
  incident_end: string;
}

export interface CaseSummary {
  case: Case;
  evidence_count: number;
  event_count: number;
  open_conflicts: number;
}

export interface EvidenceItem {
  id: string;
  case_id: string;
  type: "video" | "audio" | "csv" | "json" | "pdf" | "text" | "image" | "document";
  source_name: string;
  original_filename: string;
  sha256: string | null;
  size_bytes: number | null;
  ingested_at: string;
  processing_status: "queued" | "processing" | "extracted" | "failed";
  extraction_method: string;
  clock: {
    offset_seconds: number;
    method: string;
    note: string;
    /** For inferred clocks: this source's event ID -> the reference event it records. */
    anchors?: Record<string, string>;
    spread_seconds?: number;
  };
  simulated: boolean;
  /** Start time stored in the media file itself; not verified. */
  recorded_at?: string | null;
  extraction_note?: string;
}

export interface EvidenceUpload extends EvidenceItem {
  duplicate: boolean;
  change?: ChangeSummary | null;
}

export interface TimelineEvent {
  id: string;
  case_id: string;
  evidence_id: string;
  locator: string;
  description: string;
  source_time: string | null;
  normalized_time: string | null;
  offset_seconds: number;
  normalization_rule: string;
  approximate: boolean;
  uncertainty_seconds: number;
  state: ClaimState;
  record: Record<string, string>;
  /** Who added it, for observations and accepted AI suggestions. */
  extracted_by?: string | null;
}

export type ReviewStatus = "open" | "under_review" | "resolved" | "dismissed";

export interface ReviewNote {
  actor: string;
  at: string;
  note: string;
  status: ReviewStatus | null;
}

export interface Conflict {
  id: string;
  case_id: string;
  type: "copied_record" | "clock_offset" | "identity_not_established";
  rule_id: string;
  severity: "high" | "medium" | "review";
  evidence_ids: string[];
  event_ids: string[];
  explanation: string;
  detection_method: string;
  uncertain: string;
  status: ReviewStatus;
  requires_human_review: boolean;
  reviews: ReviewNote[];
}

export interface EvidenceLink {
  evidence_id: string;
  locator: string | null;
  relationship: "supports" | "contradicts";
}

export interface Claim {
  id: string;
  case_id: string;
  statement: string;
  kind: string;
  state: ClaimState;
  rationale: string;
  links: EvidenceLink[];
  origin: string;
  question_id?: string | null;
  created_by?: string | null;
}

export interface Hypothesis {
  id: string;
  case_id: string;
  conflict_id: string | null;
  question: string;
  description: string;
  state: ClaimState;
  notes: string;
  links: EvidenceLink[];
  reviews: ReviewNote[];
}

export interface AuditEvent {
  id: string;
  case_id: string;
  at: string;
  actor: string;
  action: string;
  entity_ref: string;
  details: string;
}

export interface OriginalRecord {
  evidence_id: string;
  filename: string;
  sha256: string | null;
  columns: string[];
  rows: Record<string, string>[];
}

export interface NewReview {
  target_id: string;
  note: string;
  status?: ReviewStatus;
  /** Who made the decision; the API falls back to its default actor when absent. */
  actor?: string;
}

export interface StagedItem {
  evidence_id: string;
  source_name: string;
  summary: string;
}

export interface ChangeSummary {
  id: string;
  case_id: string;
  at: string;
  trigger: string;
  added_evidence: string[];
  added_events: string[];
  added_claims: string[];
  conflicts_added: string[];
  conflicts_removed: string[];
  state_changes: string[];
  unchanged: string[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}

export interface Question {
  id: string;
  case_id: string;
  text: string;
  created_by: string;
  created_at: string;
}

export type Finding = "established" | "partly_established" | "not_established";

export interface Answer {
  question_id: string;
  finding: Finding;
  text: string;
  cites: string[];
}

export interface Conclusion {
  id: string;
  case_id: string;
  version: number;
  answers: Answer[];
  signed_by: string;
  role: string;
  signed_at: string;
  supersedes: string | null;
}

export interface JourneyStep {
  key: "scope" | "evidence" | "extract" | "timeline" | "questions" | "conclude";
  label: string;
  done: boolean;
  detail: string;
  href: string;
}

export interface Journey {
  case_id: string;
  steps: JourneyStep[];
  current: JourneyStep["key"];
  next_label: string;
  next_detail: string;
  next_href: string;
}

export interface Suggestion {
  id: string;
  case_id: string;
  evidence_id: string;
  locator: string;
  quote: string;
  description: string;
  proposed_time: string | null;
  approximate_seconds: number;
  date_assumed: boolean;
  quote_verified: boolean | null;
  status: "pending" | "accepted" | "rejected";
  model: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  reason: string;
  event_id: string | null;
}

export interface CitedPoint {
  text: string;
  cites: string[];
}

export interface Briefing {
  id: string;
  case_id: string;
  model: string;
  created_at: string;
  created_by: string;
  summary: CitedPoint[];
  key_facts: CitedPoint[];
  open_questions: CitedPoint[];
  next_steps: string[];
  removed: number;
}

export interface AskAnswer {
  question: string;
  can_answer: boolean;
  answer: string;
  cites: string[];
  removed: number;
  model: string;
  created_at: string;
}

export interface Draft {
  question_id: string;
  finding: Finding;
  text: string;
  cites: string[];
  removed: number;
  model: string;
}

export interface AiStatus {
  configured: boolean;
  model: string;
}
