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
  type: "video" | "audio" | "csv" | "json" | "pdf" | "text" | "image";
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
}

export interface EvidenceUpload extends EvidenceItem {
  duplicate: boolean;
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
