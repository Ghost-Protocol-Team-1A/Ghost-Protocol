import type { CaseSummary, Claim, TimelineEvent } from "./types";

export interface Metrics {
  cases: number;
  evidence: number;
  openConflicts: number;
  unresolvedClaims: number;
}

export function metrics(cases: CaseSummary[], claims: Claim[]): Metrics {
  return {
    cases: cases.length,
    evidence: cases.reduce((n, c) => n + c.evidence_count, 0),
    openConflicts: cases.reduce((n, c) => n + c.open_conflicts, 0),
    unresolvedClaims: claims.filter((c) => c.state === "unresolved").length,
  };
}

/** Number of events whose time was adjusted for a source clock offset. */
export function offsetEvents(events: TimelineEvent[]): number {
  return events.filter((e) => e.offset_seconds !== 0).length;
}

/** Zero-padded two-digit count, as in the Figma metric cards ("04"). */
export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
