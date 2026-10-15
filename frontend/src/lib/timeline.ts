import type { ClaimState, Conflict, TimelineEvent } from "./types";

export const CLAIM_STATES: ClaimState[] = ["supported", "contradicted", "inferred", "unresolved"];

export interface TimelineFilters {
  source?: string; // evidence ID, or undefined for all sources
  state?: string; // claim state, or undefined for all states
}

/** Keep events from the chosen source and claim state. Unknown filter values are ignored. */
export function filterEvents(events: TimelineEvent[], f: TimelineFilters): TimelineEvent[] {
  const state = CLAIM_STATES.includes(f.state as ClaimState) ? f.state : undefined;
  const sources = new Set(events.map((e) => e.evidence_id));
  const source = f.source && sources.has(f.source) ? f.source : undefined;
  return events.filter((e) => (!source || e.evidence_id === source) && (!state || e.state === state));
}

/** Conflicts that involve an event directly, or through its evidence item. */
export function conflictsFor(event: TimelineEvent, conflicts: Conflict[]): Conflict[] {
  return conflicts.filter(
    (c) => c.event_ids.includes(event.id) || c.evidence_ids.includes(event.evidence_id),
  );
}

/** Build a timeline URL that keeps the current filters and changes one value. */
export function timelineHref(
  caseId: string,
  current: TimelineFilters & { ev?: string },
  change: Partial<TimelineFilters & { ev?: string }>,
): string {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  if (next.source) params.set("source", next.source);
  if (next.state) params.set("state", next.state);
  if (next.ev) params.set("ev", next.ev);
  const qs = params.toString();
  return `/cases/${caseId}/timeline${qs ? `?${qs}` : ""}`;
}
