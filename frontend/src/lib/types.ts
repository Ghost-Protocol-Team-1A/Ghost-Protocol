// Mirrors backend/app/models/domain.py. Keep the two in sync; contract changes go through the lead.

export type ClaimState = "supported" | "contradicted" | "inferred" | "unresolved";

export interface Case {
  id: string;
  title: string;
  description: string;
  incident_start: string;
  incident_end: string;
  status: string;
  fictional: boolean;
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
  clock: { offset_seconds: number; method: string; note: string };
  simulated: boolean;
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
  status: "open" | "under_review" | "resolved" | "dismissed";
  requires_human_review: boolean;
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

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}
