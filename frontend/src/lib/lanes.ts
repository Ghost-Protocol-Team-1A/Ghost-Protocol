import type { ClaimState, EvidenceItem, TimelineEvent } from "./types";

export interface LaneMark {
  eventId: string;
  description: string;
  state: ClaimState;
  /** Position of the normalized time, 0–100 across the window. */
  at: number;
  /** Where the source clock put it, when an offset moved it; 0–100, clamped. */
  sourceAt: number | null;
  offsetSeconds: number;
  /** Width of the uncertainty band either side of `at`, in percent of the window. */
  spread: number;
}

export interface Lane {
  evidenceId: string;
  label: string;
  marks: LaneMark[];
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** One lane per evidence item with events inside [start, end], positioned by normalized time. */
export function buildLanes(
  events: TimelineEvent[],
  evidence: EvidenceItem[],
  start: string,
  end: string,
): Lane[] {
  const t0 = Date.parse(start);
  const span = Date.parse(end) - t0;
  const pct = (ms: number) => ((ms - t0) / span) * 100;

  return evidence
    .map((item) => {
      const marks = events
        .filter((e) => e.evidence_id === item.id && e.normalized_time)
        .map((e): LaneMark => {
          const at = pct(Date.parse(e.normalized_time!));
          const sourceMs = e.source_time ? Date.parse(e.source_time) : NaN;
          return {
            eventId: e.id,
            description: e.description,
            state: e.state,
            at,
            sourceAt: e.offset_seconds && !Number.isNaN(sourceMs) ? clamp(pct(sourceMs)) : null,
            offsetSeconds: e.offset_seconds,
            spread: (e.uncertainty_seconds * 1000 * 100) / span,
          };
        })
        .filter((m) => m.at >= 0 && m.at <= 100);
      return { evidenceId: item.id, label: item.source_name, marks };
    })
    .filter((lane) => lane.marks.length > 0);
}

/** "-2:00" style label for an offset in seconds (normalized minus source). */
export function shiftLabel(offsetSeconds: number): string {
  const shift = -offsetSeconds;
  const abs = Math.abs(shift);
  const sign = shift < 0 ? "−" : "+";
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
