import type { EvidenceItem, TimelineEvent } from "./types";

/** Map original row numbers ("18") to the event extracted from that row, for one evidence item. */
export function rowsWithEvents(events: TimelineEvent[], evidenceId: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of events) {
    const match = e.evidence_id === evidenceId && /^row (\d+)$/.exec(e.locator);
    if (match) map.set(match[1], e.id);
  }
  return map;
}

const CLOCK_METHODS: Record<string, string> = {
  declared_in_fixture_metadata: "declared demo assumption",
  inferred_from_anchors: "inferred from anchors",
};

/** Plain-language description of a source clock assumption. */
export function clockLabel(clock: EvidenceItem["clock"]): string {
  const s = clock.offset_seconds;
  if (s === 0) {
    return clock.method === "approximate_human_estimate"
      ? "Approximate human estimate"
      : "Reference clock · no offset";
  }
  const direction = s > 0 ? "fast" : "slow";
  const how = CLOCK_METHODS[clock.method] ?? clock.method;
  return `Runs ${Math.abs(s)} s ${direction} · ${how}`;
}

export function formatBytes(n: number | null): string {
  if (n === null) return "—";
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}
