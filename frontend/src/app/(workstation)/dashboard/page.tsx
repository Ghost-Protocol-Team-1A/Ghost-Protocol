import Link from "next/link";
import { Icon } from "@/components/Icon";
import panel from "@/components/panel.module.css";
import { api, ApiError } from "@/lib/api";
import { metrics, offsetEvents, pad } from "@/lib/dashboard";
import { greeting } from "@/lib/identity";
import { conflictTitle, SEVERITY_LABELS } from "@/lib/labels";
import { currentIdentity } from "@/lib/session";
import { addStagedEvidence, resetDemo } from "../actions";
import styles from "./dashboard.module.css";

const CASE_ID = "CASE-001";

/** Hour of day where the demo is presented, for the greeting. */
function lagosHour(): number {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" });
  return Number(hour.format(new Date()));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; reset?: string }>;
}) {
  const { added, reset } = await searchParams;
  const identity = await currentIdentity();

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
      api.evidence(CASE_ID),
    ]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the dashboard: {message}
      </p>
    );
  }
  const [cases, claims, conflicts, events, audit, staged, changes, evidence] = data;
  const m = metrics(cases, claims);
  const latestChange = changes.at(-1);
  const hashed = evidence.filter((e) => e.sha256).length;
  const open = conflicts.filter((c) => c.status === "open" || c.status === "under_review");
  const reviewed = conflicts.length - open.length;

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <div>
          <p className="gp-eyebrow">{CASE_ID} · fictional</p>
          <h1 className={panel.pageTitle}>
            {identity ? `${greeting(lagosHour())}, ${identity.name}.` : "Case dashboard"}
          </h1>
          <p className={styles.lead}>
            {open.length === 0
              ? "Every conflict has a decision."
              : `${open.length} conflict${open.length === 1 ? "" : "s"} need${open.length === 1 ? "s" : ""} a decision.`}{" "}
            {staged.length > 0 && "One piece of evidence is waiting to be added live."}
          </p>
        </div>
      </div>

      {reset && (
        <p role="status" className={styles.notice}>
          Demo reset: {CASE_ID} is back to its seeded state.
        </p>
      )}

      <ul className={styles.metrics}>
        <li className={styles.metric}>
          <span className={styles.metricLabel}>Evidence</span>
          <span className={styles.metricValue}>{pad(m.evidence)}</span>
          <span className={styles.metricNote}>
            {hashed} hashed · {m.evidence - hashed} simulated
          </span>
        </li>
        <li className={styles.metric}>
          <span className={styles.metricLabel}>Events</span>
          <span className={styles.metricValue}>{pad(events.length)}</span>
          <span className={styles.metricNote}>{offsetEvents(events)} time-corrected</span>
        </li>
        <li className={`${styles.metric} ${styles.metricHot}`}>
          <span className={styles.metricLabel}>Open conflicts</span>
          <span className={styles.metricValue}>{pad(open.length)}</span>
          <span className={styles.metricNote}>
            {reviewed} of {conflicts.length} decided
          </span>
        </li>
        <li className={styles.metric}>
          <span className={styles.metricLabel}>Unresolved</span>
          <span className={styles.metricValue}>{pad(m.unresolvedClaims)}</span>
          <span className={styles.metricNote}>claims the evidence can’t settle</span>
        </li>
      </ul>

      <div className={styles.grid}>
        <section className={panel.panel} aria-labelledby="decide-heading">
          <div className={styles.rowHead}>
            <h2 id="decide-heading" className={panel.panelTitle}>
              Needs a decision
            </h2>
            <Link href={`/cases/${CASE_ID}/conflicts`} className={styles.more}>
              Open inspector <Icon name="arrow" size={14} />
            </Link>
          </div>
          <ul className={styles.decisions}>
            {conflicts.map((c) => (
              <li key={c.id} className={styles.decision}>
                <div>
                  <p className={`gp-mono ${styles.ruleLine} ${styles[`sev_${c.severity}`]}`}>
                    {c.id} · {c.rule_id} · {SEVERITY_LABELS[c.severity]}
                  </p>
                  <p className={styles.decisionTitle}>{conflictTitle(c)}</p>
                </div>
                <Link href={`/cases/${CASE_ID}/conflicts?c=${c.id}`} className="gp-btn gp-btn-ghost">
                  {c.status === "open" ? "Review" : c.status.replace("_", " ")}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={panel.panel} aria-labelledby="live-heading">
          <h2 id="live-heading" className={panel.panelTitle}>
            Live evidence
          </h2>
          <p className={panel.panelCaption}>
            Add held-back evidence and see what the analysis changes, and what it does not.
          </p>
          {staged.length > 0 ? (
            staged.map((s) => (
              <div key={s.evidence_id} className={styles.staged}>
                <p className={`gp-mono ${styles.stagedId}`}>
                  {s.evidence_id} · {s.source_name}
                </p>
                <p className={styles.stagedText}>{s.summary}</p>
                <form action={addStagedEvidence}>
                  <input type="hidden" name="caseId" value={CASE_ID} />
                  <input type="hidden" name="evidenceId" value={s.evidence_id} />
                  <button type="submit" className={`gp-btn gp-btn-lime ${styles.full}`}>
                    Add {s.evidence_id} to {CASE_ID}
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className={styles.muted}>All held-back evidence has been added.</p>
          )}

          {latestChange && (
            <div className={styles.change} role={added ? "status" : undefined} aria-labelledby="change-heading">
              <h3 id="change-heading" className={styles.changeTitle}>
                {latestChange.id} · {latestChange.trigger}
              </h3>
              <dl className={styles.changeList}>
                <dt>Added</dt>
                <dd>
                  {[
                    ...latestChange.added_evidence,
                    ...latestChange.added_events,
                    ...latestChange.added_claims,
                  ].join(", ")}
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

          <form action={resetDemo}>
            <button type="submit" className={`gp-btn gp-btn-quiet ${styles.full}`}>
              <Icon name="reset" size={16} /> Reset demo
            </button>
          </form>
        </section>
      </div>

      <section className={`${panel.panel} ${styles.pipeline}`} aria-label="Evidence pipeline">
        <span className={`gp-mono ${styles.pipeLabel}`}>Pipeline</span>
        <span className="gp-chip gp-chip-lime">Ingest {m.evidence}</span>
        <span className={styles.dash} aria-hidden="true" />
        <span className="gp-chip gp-chip-lime">Normalize {offsetEvents(events)} offset</span>
        <span className={styles.dash} aria-hidden="true" />
        <span className="gp-chip gp-chip-lime">Compare {conflicts.length} rules hit</span>
        <span className={styles.dash} aria-hidden="true" />
        <span className={reviewed === conflicts.length ? "gp-chip gp-chip-lime" : "gp-chip"}>
          Review {reviewed}/{conflicts.length}
        </span>
        <span className={styles.dash} aria-hidden="true" />
        <Link href={`/cases/${CASE_ID}/report`} className="gp-chip">
          Report
        </Link>
      </section>

      <section className={panel.panel} aria-labelledby="activity-heading">
        <h2 id="activity-heading" className={panel.panelTitle}>
          Recent activity
        </h2>
        <ul className={styles.activity}>
          {audit.slice(0, 4).map((a) => (
            <li key={a.id}>
              <span className="gp-mono">{a.at.slice(11, 16)} UTC</span>
              <span className={styles.actor}>{a.actor}</span>
              <span>{a.action}</span>
              <span className="gp-mono">{a.entity_ref}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
