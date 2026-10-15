import Link from "next/link";
import { StateBadge } from "@/components/StateBadge";
import panel from "@/components/panel.module.css";
import { api, ApiError, localTime } from "@/lib/api";
import { conflictTitle } from "@/lib/labels";
import { CLAIM_STATES, conflictsFor, filterEvents, timelineHref } from "@/lib/timeline";
import styles from "./timeline.module.css";

const STATE_MEANING = {
  supported: "Backed by a cited source",
  contradicted: "Conflicts with other evidence",
  inferred: "Interpretation linked to sources",
  unresolved: "Evidence cannot establish this",
} as const;

function offsetLabel(seconds: number): string {
  const minutes = -seconds / 60;
  return `${minutes > 0 ? "+" : "−"}${Math.abs(minutes)} min`;
}

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ source?: string; state?: string; ev?: string }>;
}) {
  const { caseId } = await params;
  const query = await searchParams;

  let data;
  try {
    data = await Promise.all([api.timeline(caseId), api.evidence(caseId), api.conflicts(caseId)]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the timeline: {message}
      </p>
    );
  }
  const [allEvents, evidence, conflicts] = data;
  const events = filterEvents(allEvents, query);
  const active = { source: query.source, state: query.state };
  const selected = allEvents.find((e) => e.id === query.ev) ?? events[0];
  const selectedConflicts = selected ? conflictsFor(selected, conflicts) : [];
  const sourceName = new Map(evidence.map((e) => [e.id, e.source_name]));

  return (
    <section>
      <h1 className={panel.pageTitle}>Investigation timeline</h1>
      <p className={`${panel.pageLead} ${styles.coralText}`}>
        Review the timeline alongside its source records and contradictions.
      </p>

      <form className={`${panel.panel} ${styles.filters}`} method="get" aria-label="Timeline filters">
        <label>
          <span>Source</span>
          <select name="source" defaultValue={query.source ?? ""}>
            <option value="">All sources</option>
            {evidence.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} · {e.source_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Claim state</span>
          <select name="state" defaultValue={query.state ?? ""}>
            <option value="">All states</option>
            {CLAIM_STATES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.sort}>Sorted by normalized time</span>
        <button type="submit" className={styles.apply}>
          Apply
        </button>
        {(query.source || query.state) && (
          <Link href={`/cases/${caseId}/timeline`} className={styles.clear}>
            Clear filters
          </Link>
        )}
      </form>

      <div className={styles.layout}>
        <section className={panel.panel} aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className={panel.panelTitle}>
            Unified timeline
          </h2>
          <p className={`${panel.panelCaption} ${styles.cyanText}`}>
            Source and normalized time are displayed separately. {events.length} of {allEvents.length}{" "}
            events shown.
          </p>
          {events.length === 0 ? (
            <p className={styles.muted}>No events match these filters.</p>
          ) : (
            <ol className={styles.list}>
              {events.map((e) => (
                <li key={e.id}>
                  <Link
                    href={timelineHref(caseId, active, { ev: e.id })}
                    className={`${styles.row} ${styles[e.state]}`}
                    aria-current={selected?.id === e.id ? "true" : undefined}
                  >
                    <span className={styles.marker} aria-hidden="true" />
                    <span className={styles.times}>
                      <span className={styles.normalized}>
                        {e.approximate ? "~" : ""}
                        {localTime(e.normalized_time)}
                      </span>
                      {e.offset_seconds !== 0 && (
                        <span className={styles.source}>
                          source {e.source_time?.slice(11, 19)} ({offsetLabel(e.offset_seconds)})
                        </span>
                      )}
                    </span>
                    <span>
                      <span className={styles.description}>{e.description}</span>
                      <span className={styles.locator}>
                        {e.id} · {e.evidence_id} · {e.locator}
                      </span>
                    </span>
                    <StateBadge state={e.state} />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className={styles.side}>
          {selected && (
            <section className={`${panel.panel} ${styles.selected}`} aria-labelledby="selected-heading">
              <h2 id="selected-heading" className={panel.panelTitle}>
                Selected event · {selected.id}
              </h2>
              <p className={styles.selectedTitle}>{selected.description}</p>
              <p className={styles.locator}>
                <Link href={`/cases/${caseId}/evidence?e=${selected.evidence_id}`}>
                  {selected.evidence_id} · {sourceName.get(selected.evidence_id)} · {selected.locator}
                </Link>
              </p>
              <dl className={styles.timePair}>
                <div>
                  <dt>Source time</dt>
                  <dd className={styles.sourceTime}>{selected.source_time?.slice(11, 19) ?? "—"}</dd>
                </div>
                <div>
                  <dt>Normalized time</dt>
                  <dd>
                    {selected.approximate ? "~" : ""}
                    {localTime(selected.normalized_time)}
                  </dd>
                </div>
              </dl>
              <p className={styles.rule}>
                Rule: {selected.normalization_rule.replaceAll("_", " ")}
                {selected.uncertainty_seconds > 0 && ` · uncertainty ±${selected.uncertainty_seconds} s`}
              </p>
              <p className={styles.state}>
                <StateBadge state={selected.state} /> {STATE_MEANING[selected.state]}
              </p>
            </section>
          )}

          {selectedConflicts.map((c) => (
            <section
              key={c.id}
              className={`${panel.panel} ${styles.callout} ${styles[`sev_${c.severity}`]}`}
              aria-labelledby={`callout-${c.id}`}
            >
              <h2 id={`callout-${c.id}`} className={styles.calloutLabel}>
                Conflict detected · {c.id}
              </h2>
              <p className={styles.calloutTitle}>{conflictTitle(c)}</p>
              <p className={styles.ruleId}>{c.rule_id}</p>
              <p className={styles.calloutText}>{c.explanation}</p>
              <Link href={`/cases/${caseId}/conflicts?c=${c.id}`}>Inspect source comparison →</Link>
            </section>
          ))}
          {selected && selectedConflicts.length === 0 && (
            <p className={styles.muted}>No conflict involves {selected.id}.</p>
          )}
        </div>
      </div>

      <section className={`${panel.panel} ${styles.legend}`} aria-labelledby="legend-heading">
        <h2 id="legend-heading" className={panel.panelTitle}>
          Claim states
        </h2>
        <ul>
          {CLAIM_STATES.map((s) => (
            <li key={s} className={styles[s]}>
              <Link href={timelineHref(caseId, active, { state: s, ev: undefined })}>
                <span className={styles.legendLabel}>{s}</span>
                <span className={styles.legendMeaning}>{STATE_MEANING[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
