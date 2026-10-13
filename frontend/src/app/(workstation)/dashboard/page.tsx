import Link from "next/link";
import panel from "@/components/panel.module.css";
import { api, ApiError } from "@/lib/api";
import { metrics, offsetEvents, pad } from "@/lib/dashboard";
import { conflictTitle } from "@/lib/labels";
import { addStagedEvidence, resetDemo } from "../actions";
import styles from "./dashboard.module.css";

const CASE_ID = "CASE-001";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; reset?: string }>;
}) {
  const { added, reset } = await searchParams;

  let data;
  try {
    data = await Promise.all([
      api.cases(),
      api.claims(CASE_ID),
      api.conflicts(CASE_ID),
      api.timeline(CASE_ID),
      api.audit(CASE_ID),
      api.staged(CASE_ID),
      api.changes(CASE_ID),
    ]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the dashboard: {message}
      </p>
    );
  }
  const [cases, claims, conflicts, events, audit, staged, changes] = data;
  const m = metrics(cases, claims);
  const latestChange = changes.at(-1);

  const cards = [
    { label: "Active cases", value: m.cases, tone: styles.cyan },
    { label: "Evidence items", value: m.evidence, tone: styles.lime },
    { label: "Open conflicts", value: m.openConflicts, tone: styles.coral },
    { label: "Unresolved claims", value: m.unresolvedClaims, tone: styles.gold },
  ];

  return (
    <section>
      <h1 className={panel.pageTitle}>Case dashboard</h1>
      <p className={`${panel.pageLead} ${styles.cyanText}`}>
        A clear overview of cases, evidence processing, and decisions awaiting review.
      </p>

      {reset && (
        <p role="status" className={styles.notice}>
          Demo reset: CASE-001 is back to its seeded state.
        </p>
      )}

      <ul className={styles.metrics}>
        {cards.map((c) => (
          <li key={c.label} className={`${styles.metric} ${c.tone}`}>
            <span className={styles.metricLabel}>{c.label}</span>
            <span className={styles.metricValue}>{pad(c.value)}</span>
          </li>
        ))}
      </ul>

      <div className={styles.grid}>
        <section className={`${panel.panel} ${styles.cyanBorder}`} aria-labelledby="cases-heading">
          <h2 id="cases-heading" className={panel.panelTitle}>
            Recent cases
          </h2>
          <p className={`${panel.panelCaption} ${styles.cyanText}`}>
            Open a case to inspect evidence and event relationships.
          </p>
          <ul className={styles.rows}>
            {cases.map((c) => (
              <li key={c.case.id}>
                <Link href={`/cases/${c.case.id}/timeline`} className={styles.caseRow}>
                  <span className={styles.caseId}>{c.case.id}</span>
                  <span>
                    {c.case.title}
                    <span className={styles.status}>
                      {c.case.status}
                      {c.case.fictional && " · fictional"}
                    </span>
                  </span>
                  <span className={styles.count}>{pad(c.evidence_count)} items</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${panel.panel} ${styles.coralBorder}`} aria-labelledby="attention-heading">
          <h2 id="attention-heading" className={panel.panelTitle}>
            Needs attention
          </h2>
          <p className={panel.panelCaption}>Items requiring investigator review.</p>
          <ul className={styles.attention}>
            {conflicts.map((c) => (
              <li key={c.id} className={styles[c.severity]}>
                <Link href={`/cases/${CASE_ID}/conflicts?c=${c.id}`}>{conflictTitle(c)}</Link>
                <span className={styles.meta}>
                  {c.id} · {c.rule_id}
                  {c.evidence_ids.length > 0 && ` · ${c.evidence_ids.join(", ")}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={`${panel.panel} ${styles.wide}`} aria-labelledby="pipeline-heading">
        <div>
          <h2 id="activity-heading" className={`${panel.panelTitle} ${styles.cyanText}`}>
            Recent activity
          </h2>
          <ul className={styles.activity} aria-labelledby="activity-heading">
            {audit.slice(0, 3).map((a) => (
              <li key={a.id}>
                <span className={panel.mono}>{a.at.slice(11, 16)} UTC</span> · {a.entity_ref}{" "}
                {a.action.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 id="pipeline-heading" className={`${panel.panelTitle} ${styles.cyanText}`}>
            Evidence pipeline
          </h2>
          <ol className={styles.pipeline}>
            <li className={styles.cyan}>
              Ingest <span>{m.evidence} sources</span>
            </li>
            <li className={styles.lime}>
              Normalize <span>{offsetEvents(events)} offset applied</span>
            </li>
            <li className={styles.coral}>
              Compare <span>{m.openConflicts} conflicts</span>
            </li>
            <li className={styles.gold}>
              Review <span>{m.unresolvedClaims} unresolved</span>
            </li>
          </ol>
          <p className={styles.provenance}>Provenance preserved at every step.</p>
        </div>
      </section>

      <section className={`${panel.panel} ${styles.live}`} aria-labelledby="live-heading">
        <h2 id="live-heading" className={panel.panelTitle}>
          Live demo
        </h2>
        <p className={panel.panelCaption}>
          Add held-back evidence and see what the analysis changes, and what it does not.
        </p>

        {staged.length > 0 ? (
          <ul className={styles.staged}>
            {staged.map((s) => (
              <li key={s.evidence_id}>
                <span>
                  <strong>{s.evidence_id}</strong> {s.source_name}
                  <span className={styles.meta}>{s.summary}</span>
                </span>
                <form action={addStagedEvidence}>
                  <input type="hidden" name="caseId" value={CASE_ID} />
                  <input type="hidden" name="evidenceId" value={s.evidence_id} />
                  <button type="submit" className={styles.primary}>
                    Add {s.evidence_id} to {CASE_ID}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.meta}>All held-back evidence has been added.</p>
        )}

        {latestChange && (
          <div
            className={styles.change}
            role={added ? "status" : undefined}
            aria-labelledby="change-heading"
          >
            <h3 id="change-heading" className={styles.changeTitle}>
              {latestChange.id} · {latestChange.trigger}
            </h3>
            <dl className={styles.changeList}>
              <dt>Added</dt>
              <dd>
                {[...latestChange.added_evidence, ...latestChange.added_events, ...latestChange.added_claims].join(
                  ", ",
                )}
              </dd>
              <dt>Conflicts</dt>
              <dd>
                {latestChange.conflicts_added.length || latestChange.conflicts_removed.length
                  ? [
                      ...latestChange.conflicts_added.map((c) => `+${c}`),
                      ...latestChange.conflicts_removed.map((c) => `−${c}`),
                    ].join(", ")
                  : "None added or removed"}
              </dd>
              <dt>State changes</dt>
              <dd>{latestChange.state_changes.join("; ") || "None"}</dd>
              <dt>Did not change</dt>
              <dd>
                <ul className={styles.unchanged}>
                  {latestChange.unchanged.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </dd>
            </dl>
          </div>
        )}

        <form action={resetDemo} className={styles.resetForm}>
          <button type="submit" className={styles.secondary}>
            Reset demo
          </button>
          <span className={styles.meta}>Restores CASE-001 to its seeded, fictional state.</span>
        </form>
      </section>
    </section>
  );
}
