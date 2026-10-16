import Link from "next/link";
import { StateBadge } from "@/components/StateBadge";
import panel from "@/components/panel.module.css";
import { api, ApiError, localTime } from "@/lib/api";
import { OriginalPreview } from "@/features/evidence/OriginalPreview";
import { ClockForm } from "@/features/workbench/Forms";
import { clockLabel, extractionLabel, formatBytes, rowsWithEvents } from "@/lib/evidence";
import { conflictTitle } from "@/lib/labels";
import styles from "./evidence.module.css";

export default async function EvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { caseId } = await params;
  const { e: wanted } = await searchParams;

  let data;
  try {
    data = await Promise.all([api.evidence(caseId), api.timeline(caseId), api.conflicts(caseId)]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load evidence: {message}
      </p>
    );
  }
  const [evidence, events, conflicts] = data;
  const item = evidence.find((x) => x.id === wanted) ?? evidence[0];
  if (!item) {
    return (
      <section>
        <h1 className={`${panel.pageTitle} ${styles.cyan}`}>Evidence viewer</h1>
        <p className={panel.pageLead}>{caseId} has no evidence yet.</p>
        <div className={panel.panel}>
          <p className={styles.muted}>
            Evidence added to this case will appear here with its SHA-256, source clock and the
            events extracted from it. Every addition is recorded in the audit trail.
          </p>
          <Link href={`/cases/${caseId}/intake`}>Upload the first file →</Link>
        </div>
      </section>
    );
  }

  const original = await api.original(caseId, item.id).catch(() => undefined);
  const linked = events.filter((e) => e.evidence_id === item.id);
  const related = conflicts.filter((c) => c.evidence_ids.includes(item.id));
  const eventRows = rowsWithEvents(events, item.id);

  return (
    <section>
      <h1 className={`${panel.pageTitle} ${styles.cyan}`}>Evidence viewer</h1>
      <p className={panel.pageLead}>
        Verify source context, inspect extraction locators, and keep integrity metadata visible.
      </p>

      <nav aria-label="Evidence items" className={styles.picker}>
        {evidence.map((x) => (
          <Link
            key={x.id}
            href={`?e=${x.id}`}
            aria-current={x.id === item.id ? "true" : undefined}
            className={styles.pick}
          >
            <span className={styles.pickId}>{x.id}</span> {x.source_name}
          </Link>
        ))}
      </nav>

      <div className={styles.layout}>
        <section className={panel.panel} aria-labelledby="source-heading">
          <h2 id="source-heading" className={`${panel.panelTitle} ${styles.cyan}`}>
            Source viewer · {item.id}
          </h2>
          <p className={panel.panelCaption}>
            {item.source_name} · {item.original_filename}
          </p>

          {original ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.caption}>
                  Original rows as ingested (read-only). Highlighted rows produced timeline events.
                </caption>
                <thead>
                  <tr>
                    {original.columns.map((col) => (
                      <th key={col} scope="col">
                        {col}
                      </th>
                    ))}
                    <th scope="col">event</th>
                  </tr>
                </thead>
                <tbody>
                  {original.rows.map((row, index) => {
                    // Seeded logs carry a "row" column; uploaded ones are numbered by position.
                    const rowNumber = row.row ?? String(index + 1);
                    const eventId = eventRows.get(rowNumber);
                    return (
                      <tr key={rowNumber} className={eventId ? styles.hit : undefined}>
                        {original.columns.map((col) => (
                          <td key={col}>{col === "timestamp" ? row[col]?.slice(11, 19) : row[col]}</td>
                        ))}
                        <td>{eventId ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : item.sha256 ? (
            <OriginalPreview item={item} href={`/cases/${caseId}/evidence/${item.id}/file`} />
          ) : original === null ? (
            <div className={styles.simulated} role="note">
              <p className={styles.simulatedTitle}>No original file in this demo</p>
              <p>
                {item.type.toUpperCase()} evidence is not parsed in the MVP. Its events below come
                from seed metadata and are labeled as simulated extraction.
              </p>
            </div>
          ) : (
            <p role="alert" className={panel.error}>
              The original file could not be loaded.
            </p>
          )}
        </section>

        <aside className={panel.panel} aria-labelledby="provenance-heading">
          <h2 id="provenance-heading" className={`${panel.panelTitle} ${styles.cyan}`}>
            Source provenance
          </h2>
          <p className={panel.panelCaption}>Integrity metadata and chain of custody.</p>
          <dl className={styles.facts}>
            <dt>SHA-256</dt>
            <dd className={styles.hash}>{item.sha256 ?? "Not applicable — no file stored"}</dd>
            <dt>Size</dt>
            <dd>{formatBytes(item.size_bytes)}</dd>
            <dt>Ingested</dt>
            <dd>{item.ingested_at.replace("T", " ").replace("Z", " UTC")}</dd>
            <dt>Extraction</dt>
            <dd>
              {extractionLabel(item)}
            </dd>
            <dt className={styles.cyan}>Source clock</dt>
            <dd>
              {clockLabel(item.clock)}
              {item.clock.note && <span className={styles.note}>{item.clock.note}</span>}
            </dd>
            <dt>Status</dt>
            <dd>{item.processing_status}</dd>
          </dl>
        </aside>
      </div>

      <section className={`${panel.panel} ${styles.linked}`} aria-labelledby="linked-heading">
        <h2 id="linked-heading" className={panel.panelTitle}>
          Linked events
        </h2>
        <p className={panel.panelCaption}>Events extracted from this source with precise locators.</p>
        {linked.length === 0 ? (
          <p className={styles.muted}>No events from this source fall inside the incident window.</p>
        ) : (
          <ul className={styles.cards}>
            {linked.map((e) => (
              <li key={e.id} className={styles.card}>
                <span className={styles.pickId}>{e.id}</span>
                <span>{e.description}</span>
                <span className={styles.muted}>{e.locator}</span>
                <span className={panel.mono}>
                  {e.offset_seconds !== 0
                    ? `${e.source_time?.slice(11, 19)} → ${localTime(e.normalized_time)}`
                    : `${e.approximate ? "~" : ""}${localTime(e.normalized_time)}`}
                </span>
                <StateBadge state={e.state} />
              </li>
            ))}
          </ul>
        )}

        {related.length > 0 && (
          <p className={styles.related}>
            Conflicts involving {item.id}:{" "}
            {related.map((c, i) => (
              <span key={c.id}>
                {i > 0 && " · "}
                <Link href={`/cases/${caseId}/conflicts?c=${c.id}`}>
                  {c.id} {conflictTitle(c)}
                </Link>
              </span>
            ))}
          </p>
        )}
      </section>
      {!item.simulated && (
        <section id="clock" className={panel.panel} aria-labelledby="clock-heading" style={{ marginTop: "var(--gp-space-6)" }}>
          <h2 id="clock-heading" className={panel.panelTitle}>
            Source clock · {item.id}
          </h2>
          <p className={panel.panelCaption}>
            Now: {clockLabel(item.clock)}
            {item.clock.note ? ` · ${item.clock.note}` : ""}. Original times never change; only normalized time is re-worked.
          </p>
          <ClockForm
            caseId={caseId}
            item={item}
            ownEvents={linked}
            trustedEvents={events.filter((e) =>
              evidence.some((x) => x.id === e.evidence_id && x.id !== item.id && x.clock.method === "reference_clock"),
            )}
          />
        </section>
      )}
    </section>
  );
}
