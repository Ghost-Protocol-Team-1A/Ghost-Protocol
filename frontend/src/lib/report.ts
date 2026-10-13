import type { Claim, Conflict, EvidenceItem, TimelineEvent } from "./types";

export interface ReportCheck {
  label: string;
  value: string;
  ok: boolean;
}

/** Readiness checks shown beside the report preview. They describe the data; they do not block export. */
export function reportChecks(
  events: TimelineEvent[],
  evidence: EvidenceItem[],
  conflicts: Conflict[],
  claims: Claim[],
): ReportCheck[] {
  const evidenceIds = new Set(evidence.map((e) => e.id));
  const linked = events.filter((e) => evidenceIds.has(e.evidence_id)).length;
  const reviewed = conflicts.filter((c) => c.status === "resolved" || c.status === "dismissed").length;
  const unresolved = claims.filter((c) => c.state === "unresolved").length;
  const uncited = claims.filter((c) => c.state !== "unresolved" && c.links.length === 0).length;
  return [
    { label: "Events linked to a source", value: `${linked} / ${events.length}`, ok: linked === events.length },
    { label: "Claims citing evidence", value: uncited === 0 ? "All" : `${uncited} missing`, ok: uncited === 0 },
    { label: "Conflicts reviewed", value: `${reviewed} / ${conflicts.length}`, ok: reviewed === conflicts.length },
    { label: "Unknowns disclosed", value: `${unresolved} unresolved listed`, ok: true },
    { label: "Human approval", value: "Pending", ok: false },
  ];
}

export const REPORT_SECTIONS = [
  { id: "scope", label: "Scope & case context" },
  { id: "sources", label: "Source inventory" },
  { id: "timeline", label: "Reconstructed timeline" },
  { id: "conflicts", label: "Conflicts & rules" },
  { id: "hypotheses", label: "Alternative hypotheses" },
  { id: "unresolved", label: "Unresolved questions" },
  { id: "methods", label: "Methods & limitations" },
] as const;
