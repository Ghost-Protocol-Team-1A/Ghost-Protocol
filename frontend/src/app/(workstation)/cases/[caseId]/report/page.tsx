import { StateBadge } from "@/components/StateBadge";
import panel from "@/components/panel.module.css";
import { api, ApiError, localTime } from "@/lib/api";
import { conflictTitle } from "@/lib/labels";
import { REPORT_SECTIONS, reportChecks } from "@/lib/report";
import styles from "./report.module.css";

export default async function ReportPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;

  let data;
  try {
    data = await Promise.all([
      api.case(caseId),
      api.evidence(caseId),
      api.timeline(caseId),
      api.conflicts(caseId),
      api.claims(caseId),
      api.hypotheses(caseId),
      api.reportAvailable(caseId),
    ]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the report: {message}
      </p>
    );
  }
  const [summary, evidence, events, conflicts, claims, hypotheses, exportReady] = data;
  const checks = reportChecks(events, evidence, conflicts, claims);
  const unresolved = claims.filter((c) => c.state === "unresolved");
  const c = summary.case;

  return (
    <section>
      <h1 className={panel.pageTitle}>Report builder</h1>
      <p className={panel.pageLead}>
        Build a reviewable report that separates supported claims, inferences, contradictions, and
        unresolved questions.
      </p>

      <div className={styles.layout}>
        <nav className={panel.panel} aria-label="Report sections">
          <h2 className={panel.panelTitle}>Report sections</h2>
          <ol className={styles.sections}>
            {REPORT_SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span> {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className={`${panel.panel} ${styles.preview}`} aria-label="Report preview">
          <p className={styles.notice}>
            Investigative aid only. This report does not determine responsibility or guilt. All
            data is fictional.
          </p>

          <h2 id="scope" className={styles.h}>01 Scope &amp; case context</h2>
          <p>
            <strong>{c.id}</strong> · {c.title}. {c.description}
          </p>
          <p className={styles.muted}>
            Incident window {c.incident_start.slice(11, 16)}–{c.incident_end.slice(11, 16)} site
            time (UTC{c.incident_start.slice(19)}), {c.incident_start.slice(0, 10)}.
          </p>

          <h2 id="sources" className={styles.h}>02 Source inventory</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Source</th>
                <th scope="col">Type</th>
                <th scope="col">Integrity</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id}>
                  <td>{e.id}</td>
                  <td>{e.source_name}</td>
                  <td>{e.type}</td>
                  <td className={styles.hash}>
                    {e.sha256 ? `SHA-256 ${e.sha256.slice(0, 12)}…` : "Simulated extraction, no file"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 id="timeline" className={styles.h}>03 Reconstructed timeline</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Normalized</th>
                <th scope="col">Source time</th>
                <th scope="col">Event</th>
                <th scope="col">Citation</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className={panel.mono}>
                    {e.approximate ? "~" : ""}
                    {localTime(e.normalized_time)}
                  </td>
                  <td className={panel.mono}>
                    {e.source_time?.slice(11, 19) ?? "—"}
                    {e.offset_seconds !== 0 && <span className={styles.muted}> ({-e.offset_seconds} s)</span>}
                  </td>
                  <td>{e.description}</td>
                  <td className={styles.muted}>
                    {e.evidence_id} · {e.locator}
                  </td>
                  <td>
                    <StateBadge state={e.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 id="conflicts" className={styles.h}>04 Conflicts &amp; rules</h2>
          <ul className={styles.list}>
            {conflicts.map((x) => (
              <li key={x.id}>
                <strong>
                  {x.id} · {conflictTitle(x)}
                </strong>{" "}
                <span className={styles.rule}>{x.rule_id}</span>
                <p>{x.explanation}</p>
                <p className={styles.muted}>Uncertain: {x.uncertain}</p>
              </li>
            ))}
          </ul>

          <h2 id="hypotheses" className={styles.h}>05 Alternative hypotheses</h2>
          <ul className={styles.list}>
            {hypotheses.map((h) => (
              <li key={h.id}>
                <strong>{h.id}</strong> {h.description} <StateBadge state={h.state} />
                <p className={styles.muted}>{h.notes}</p>
              </li>
            ))}
          </ul>

          <h2 id="unresolved" className={styles.h}>06 Unresolved questions</h2>
          <ul className={styles.list}>
            {unresolved.map((u) => (
              <li key={u.id}>
                <strong>{u.id}</strong> {u.statement}
                <p className={styles.muted}>{u.rationale}</p>
              </li>
            ))}
          </ul>

          <h2 id="methods" className={styles.h}>07 Methods &amp; limitations</h2>
          <ul className={styles.list}>
            <li>Log files (CSV) are parsed deterministically; video, audio and PDF extraction is simulated from seed metadata in this demo.</li>
            <li>Source times are never overwritten. Normalized times are derived and carry the rule that produced them.</li>
            <li>The E-02 clock offset is declared in the fixture metadata, not inferred from the evidence.</li>
            <li>Conflicts come from deterministic rules with stable IDs. A conflict is a prompt for review, not proof of tampering.</li>
            <li>Results on a small synthetic case say nothing about accuracy on real investigations.</li>
          </ul>
        </article>

        <aside className={panel.panel} aria-labelledby="status-heading">
          <h2 id="status-heading" className={panel.panelTitle}>
            Report status
          </h2>
          <dl className={styles.checks}>
            {checks.map((k) => (
              <div key={k.label} className={styles.check}>
                <dt>{k.label}</dt>
                <dd className={k.ok ? styles.ok : styles.pending}>
                  <span aria-hidden="true">{k.ok ? "✓" : "•"}</span> {k.value}
                </dd>
              </div>
            ))}
          </dl>

          <h3 className={styles.exportTitle}>Export</h3>
          {exportReady ? (
            <div className={styles.exports}>
              <a className={styles.primary} href={api.reportUrl(caseId, "md")}>
                Download Markdown
              </a>
              <a className={styles.secondary} href={api.reportUrl(caseId, "json")}>
                Download JSON
              </a>
            </div>
          ) : (
            <div className={styles.exports}>
              <button type="button" className={styles.primary} disabled>
                Download Markdown
              </button>
              <button type="button" className={styles.secondary} disabled>
                Download JSON
              </button>
              <p className={styles.muted}>
                Export is not available yet: the report endpoint is still being built (issue #2).
                The preview shows exactly what it will contain.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
