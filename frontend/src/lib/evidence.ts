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
  declared_by_investigator: "declared by an investigator",
};

/** Plain-language description of a source clock assumption. */
export function clockLabel(clock: EvidenceItem["clock"]): string {
  const s = clock.offset_seconds;
  if (clock.method === "not_set") return "Not verified · device clock taken as recorded";
  if (s === 0) {
    return clock.method === "approximate_human_estimate"
      ? "Approximate human estimate"
      : "Reference clock · no offset";
  }
  const direction = s > 0 ? "fast" : "slow";
  const how = CLOCK_METHODS[clock.method] ?? clock.method;
  return `Runs ${Math.abs(s)} s ${direction} · ${how}`;
}

/** How an item's events were (or were not) produced. */
export function extractionLabel(
  item: Pick<EvidenceItem, "processing_status" | "simulated" | "type"> & { extraction_method?: string },
): string {
  if (item.extraction_method === "manual_observation") return "Observations logged by investigators";
  if (item.extraction_method === "ai_suggested_human_accepted") return "AI-suggested, accepted by a person";
  if (item.extraction_method === "deterministic_log_parser") return "Deterministic log parser";
  if (item.processing_status === "queued") return "Not run yet · stored and hashed on upload";
  if (item.simulated) return "Simulated from seed metadata";
  return item.type === "csv" ? "Deterministic CSV parser" : "Deterministic parser";
}

export function formatBytes(n: number | null): string {
  if (n === null) return "—";
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}
