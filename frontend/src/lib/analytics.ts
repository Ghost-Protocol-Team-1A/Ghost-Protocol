import type { AuditEvent, Claim, ClaimState, Conflict, EvidenceItem, TimelineEvent } from "./types";

/** Severity order, used for stacking and legends everywhere. */
export const STATE_ORDER: ClaimState[] = ["contradicted", "unresolved", "inferred", "supported"];

export interface AnalyticsFilters {
  source?: string;
  state?: string;
}

export interface Analytics {
  kpis: { events: number; sources: number; supportedPct: number; corrected: number; decided: number; conflicts: number };
  activity: { evidenceId: string; label: string; bins: number[] }[];
  binLabels: string[];
  reliability: { evidenceId: string; label: string; counts: Record<ClaimState, number> }[];
  claims: Record<ClaimState, number>;
  clocks: { evidenceId: string; label: string; offset: number; method: string }[];
  conflicts: { rule: string; open: number; decided: number }[];
  heat: { actor: string; hours: number[] }[];
}

const emptyStates = (): Record<ClaimState, number> => ({ contradicted: 0, unresolved: 0, inferred: 0, supported: 0 });

/** Everything the analytics page draws, from the case's own records and the active filters. */
export function analyse(
  events: TimelineEvent[],
  evidence: EvidenceItem[],
  claims: Claim[],
  conflicts: Conflict[],
  audit: AuditEvent[],
  filters: AnalyticsFilters = {},
  bins = 12,
): Analytics {
  const shown = events.filter(
    (e) => (!filters.source || e.evidence_id === filters.source) && (!filters.state || e.state === filters.state),
  );
  const sources = evidence.filter((x) => !filters.source || x.id === filters.source);
  const timed = shown.flatMap((e) => (e.normalized_time ? [Date.parse(e.normalized_time)] : []));
  const start = timed.length ? Math.min(...timed) : 0;
  const end = timed.length ? Math.max(...timed) : 0;
  const width = Math.max(end - start, 60_000) / bins;
  const binOf = (t: number) => Math.min(bins - 1, Math.floor((t - start) / width));

  const activity = sources.map((x) => {
    const counts = Array<number>(bins).fill(0);
    for (const e of shown) if (e.evidence_id === x.id && e.normalized_time) counts[binOf(Date.parse(e.normalized_time))] += 1;
    return { evidenceId: x.id, label: x.source_name, bins: counts };
  });

  const reliability = sources
    .map((x) => {
      const counts = emptyStates();
      for (const e of shown) if (e.evidence_id === x.id) counts[e.state] += 1;
      return { evidenceId: x.id, label: x.source_name, counts };
    })
    .filter((r) => STATE_ORDER.some((s) => r.counts[s] > 0));

  const claimCounts = emptyStates();
  for (const c of claims) if (!filters.state || c.state === filters.state) claimCounts[c.state] += 1;

  const byRule = new Map<string, { open: number; decided: number }>();
  for (const c of conflicts) {
    const row = byRule.get(c.rule_id) ?? { open: 0, decided: 0 };
    if (c.status === "open") row.open += 1;
    else row.decided += 1;
    byRule.set(c.rule_id, row);
  }

  const actors = new Map<string, number[]>();
  for (const a of audit) {
    const hour = new Date(a.at).getUTCHours();
    const row = actors.get(a.actor) ?? Array<number>(24).fill(0);
    row[hour] += 1;
    actors.set(a.actor, row);
  }

  const supported = shown.filter((e) => e.state === "supported").length;
  return {
    kpis: {
      events: shown.length,
      sources: new Set(shown.map((e) => e.evidence_id)).size,
      supportedPct: shown.length ? Math.round((supported / shown.length) * 100) : 0,
      corrected: shown.filter((e) => e.offset_seconds !== 0).length,
      decided: conflicts.filter((c) => c.status !== "open").length,
      conflicts: conflicts.length,
    },
    activity,
    binLabels: timed.length
      ? [0, Math.floor(bins / 2), bins].map((i) => new Date(start + i * width).toISOString())
      : [],
    reliability,
    claims: claimCounts,
    clocks: sources
      .filter((x) => !x.simulated || x.clock.offset_seconds !== 0)
      .map((x) => ({ evidenceId: x.id, label: x.source_name, offset: x.clock.offset_seconds, method: x.clock.method })),
    conflicts: [...byRule].map(([rule, v]) => ({ rule, ...v })),
    heat: [...actors].map(([actor, hours]) => ({ actor, hours })).sort((a, b) => a.actor.localeCompare(b.actor)),
  };
}
