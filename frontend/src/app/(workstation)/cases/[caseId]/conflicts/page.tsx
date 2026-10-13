import Link from "next/link";
import { StateBadge } from "@/components/StateBadge";
import panel from "@/components/panel.module.css";
import { api, ApiError, localTime } from "@/lib/api";
import { conflictTitle, selectConflict, SEVERITY_LABELS } from "@/lib/labels";
import styles from "./conflicts.module.css";

export default async function ConflictsPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { caseId } = await params;
  const { c: wanted } = await searchParams;

  let data;
  try {
    data = await Promise.all([
      api.conflicts(caseId),
      api.timeline(caseId),
      api.evidence(caseId),
      api.hypotheses(caseId),
    ]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load conflicts: {message}
      </p>
    );
  }
  const [conflicts, events, evidence, hypotheses] = data;
  const selected = selectConflict(conflicts, wanted);
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const alternatives = hypotheses.filter((h) => h.conflict_id === selected?.id);

  return (
    <section>
      <h1 className={`${panel.pageTitle} ${styles.coral}`}>Conflict inspector</h1>
      <p className={panel.pageLead}>
        Review contradictions through explicit rules, source records, alternative explanations,
        and human decisions.
      </p>

      <div className={styles.layout}>
        <nav className={panel.panel} aria-label="Open conflicts">
          <h2 className={`${panel.panelTitle} ${styles.coral}`}>Open conflicts</h2>
          <p className={panel.panelCaption}>Review prompts, not accusations.</p>
          {conflicts.length === 0 ? (
            <p className={styles.muted}>No conflicts detected for this case.</p>
          ) : (
            <ul className={styles.list}>
              {conflicts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`?c=${c.id}`}
                    className={`${styles.item} ${styles[c.severity]}`}
                    aria-current={c.id === selected?.id ? "true" : undefined}
                  >
                    <span className={styles.itemId}>{c.id}</span>
                    <span className={styles.itemTitle}>{conflictTitle(c)}</span>
                    <span className={styles.itemSeverity}>{SEVERITY_LABELS[c.severity]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {selected && (
          <div className={styles.detailColumn}>
            <article className={panel.panel} aria-labelledby="conflict-heading">
              <h2 id="conflict-heading" className={`${styles.detailTitle} ${styles.coral}`}>
                {selected.id} · {conflictTitle(selected)}
              </h2>
              <p className={styles.rule}>
                {selected.rule_id} · {selected.detection_method.replaceAll("_", " ")}
              </p>
              <p className={styles.explanation}>{selected.explanation}</p>

              {selected.event_ids.length > 0 && (
                <table className={styles.table}>
                  <caption className={styles.srOnly}>Source records compared by the rule</caption>
                  <thead>
                    <tr>
                      <th scope="col">Source record</th>
                      <th scope="col">Source time</th>
                      <th scope="col">Normalized time</th>
                      <th scope="col">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.event_ids.map((id, i) => {
                      const ev = eventsById.get(id);
                      if (!ev) return null;
                      const role =
                        selected.type === "copied_record" ? (i === 0 ? "Original" : "Copy") : "";
                      const source = evidenceById.get(ev.evidence_id);
                      return (
                        <tr key={id}>
                          <td>
                            {role && <strong>{role} · </strong>}
                            {ev.evidence_id} {source?.source_name} / {ev.locator}
                            <span className={styles.eventId}>{ev.id}</span>
                          </td>
                          <td className={panel.mono}>{ev.source_time?.slice(11, 19) ?? "—"}</td>
                          <td className={panel.mono}>{localTime(ev.normalized_time)}</td>
                          <td>
                            <StateBadge state={ev.state} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <dl className={styles.facts}>
                <dt>What remains uncertain</dt>
                <dd>{selected.uncertain}</dd>
                <dt>Evidence involved</dt>
                <dd>
                  {selected.evidence_ids.length
                    ? selected.evidence_ids
                        .map((id) => {
                          const e = evidenceById.get(id);
                          const integrity = e?.sha256
                            ? `SHA-256 ${e.sha256.slice(0, 8)}…`
                            : "simulated extraction";
                          return `${id} ${e?.source_name ?? ""} (${integrity})`;
                        })
                        .join(" · ")
                    : "None — the rule fired because no source supports the claim."}
                </dd>
                <dt>Status</dt>
                <dd>
                  {selected.status.replace("_", " ")}
                  {selected.requires_human_review && " · requires human review"}
                </dd>
              </dl>
            </article>

            <section className={panel.panel} aria-labelledby="alternatives-heading">
              <h2 id="alternatives-heading" className={panel.panelTitle}>
                Alternative explanations
              </h2>
              <p className={panel.panelCaption}>
                Supporting evidence, conflicting evidence, and what remains unknown.
              </p>
              {alternatives.length === 0 ? (
                <p className={styles.muted}>No alternative explanations recorded for this conflict.</p>
              ) : (
                <ul className={styles.hypotheses}>
                  {alternatives.map((h) => (
                    <li key={h.id}>
                      <span className={styles.itemId}>{h.id}</span>
                      <span>{h.description}</span>
                      <StateBadge state={h.state} />
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/cases/${caseId}/hypotheses?c=${selected.id}`}>
                Compare hypotheses →
              </Link>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
