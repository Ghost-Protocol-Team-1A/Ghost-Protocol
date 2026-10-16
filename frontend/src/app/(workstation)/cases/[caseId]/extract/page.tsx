import Link from "next/link";
import panel from "@/components/panel.module.css";
import { AiReadButton, ObservationForm, SuggestionCard } from "@/features/workbench/Forms";
import w from "@/features/workbench/workbench.module.css";
import { api, ApiError, localTime } from "@/lib/api";
import type { EvidenceItem } from "@/lib/types";

const LOGS = new Set(["csv", "json", "text"]);
const RECORDINGS = new Set(["audio", "video"]);

function status(item: EvidenceItem, pending: number, events: number): string {
  if (pending) return `${pending} AI suggestion${pending === 1 ? "" : "s"} to review`;
  if (item.simulated) return `${events} events · simulated from metadata`;
  if (events) return `${events} event${events === 1 ? "" : "s"}`;
  if (RECORDINGS.has(item.type)) return "Log what you see or hear";
  return LOGS.has(item.type) ? "No timed rows found" : "Ask the AI or add events";
}

export default async function ExtractPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { caseId } = await params;
  const { e } = await searchParams;
  let data;
  try {
    data = await Promise.all([
      api.case(caseId),
      api.evidence(caseId),
      api.timeline(caseId),
      api.suggestions(caseId),
      api.aiStatus().catch(() => ({ configured: false, model: "" })),
    ]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load extraction: {message}
      </p>
    );
  }
  const [summary, evidence, events, suggestions, ai] = data;
  const count = (id: string) => events.filter((x) => x.evidence_id === id).length;
  const pendingFor = (id: string) => suggestions.filter((s) => s.evidence_id === id && s.status === "pending").length;
  const firstNeeding = evidence.find((x) => pendingFor(x.id) || (!x.simulated && count(x.id) === 0));
  const item = evidence.find((x) => x.id === e) ?? firstNeeding ?? evidence[0];

  if (!item) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-6)" }}>
        <h1 className={panel.pageTitle}>Turn evidence into events</h1>
          <p className={w.muted}>
          No evidence yet. <Link href={`/cases/${caseId}/intake`}>Upload the first file →</Link>
        </p>
      </section>
    );
  }
  const own = events.filter((x) => x.evidence_id === item.id);
  const itemSuggestions = suggestions.filter((s) => s.evidence_id === item.id);
  const readable = item.type === "pdf" || item.type === "image" || item.type === "document" || item.type === "text";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-6)" }}>
      <div>
        <p className="gp-eyebrow">Step 3 · Extract</p>
        <h1 className={panel.pageTitle}>Turn evidence into events</h1>
        <p className={panel.pageLead}>
          Logs are parsed for you. Recordings need a person to say what they show. Documents and photos can be read by the
          AI, but nothing reaches the timeline until you accept it.
        </p>
      </div>

      <div className={w.sidepanel}>
        <nav aria-label="Evidence" className={panel.panel} style={{ padding: 8 }}>
          {evidence.map((x) => (
            <Link key={x.id} href={`?e=${x.id}`} className={w.pick} aria-current={x.id === item.id ? "true" : undefined}>
              <span className={w.pickMeta}>
                {x.id} · {x.type.toUpperCase()}
              </span>
              <span>{x.source_name}</span>
              <span className={w.pickMeta} style={{ color: pendingFor(x.id) ? "var(--gp-state-inferred)" : undefined }}>
                {status(x, pendingFor(x.id), count(x.id))}
              </span>
            </Link>
          ))}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-4)" }}>
          <div className={panel.panel}>
            <div className={w.row} style={{ justifyContent: "space-between" }}>
              <h2 className={panel.panelTitle}>
                {item.id} · {item.original_filename}
              </h2>
              <Link href={`/cases/${caseId}/evidence?e=${item.id}`}>Open in viewer →</Link>
            </div>
            <p className={w.muted}>{item.extraction_note || item.extraction_method.replaceAll("_", " ")}</p>

            {item.simulated && (
              <p className={w.muted} style={{ marginTop: 12 }}>
                This demo item has no original file; its events come from seed metadata and are labelled simulated.
              </p>
            )}

            {!item.simulated && LOGS.has(item.type) && (
              <p style={{ marginTop: 12 }}>
                Parsed automatically on upload. {own.length ? <Link href={`/cases/${caseId}/timeline?source=${item.id}`}>See its {own.length} events on the timeline →</Link> : "No row carried a readable date and time."}
              </p>
            )}

            {!item.simulated && RECORDINGS.has(item.type) && (
              <div style={{ marginTop: 16 }}>
                <ObservationForm caseId={caseId} item={item} incidentStart={summary.case.incident_start} />
              </div>
            )}

            {!item.simulated && readable && !LOGS.has(item.type) && (
              <div style={{ marginTop: 16 }}>
                <AiReadButton caseId={caseId} item={item} configured={ai.configured} />
              </div>
            )}
          </div>

          {itemSuggestions.length > 0 && (
            <div className={panel.panel}>
              <div className={w.row} style={{ justifyContent: "space-between" }}>
                <h2 className={panel.panelTitle}>AI suggestions</h2>
                <span className={w.aiTag}>Not evidence until you accept</span>
              </div>
              <ul className={w.list} style={{ marginTop: 12 }}>
                {itemSuggestions.map((s) => (
                  <SuggestionCard key={s.id} caseId={caseId} s={s} incidentStart={summary.case.incident_start} />
                ))}
              </ul>
            </div>
          )}

          {own.length > 0 && !LOGS.has(item.type) && (
            <div className={panel.panel}>
              <h2 className={panel.panelTitle}>Events from {item.id}</h2>
              <table className="gp-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--gp-text-sm)" }}>
                <thead>
                  <tr>
                    {["Where", "Source time", "Normalized", "Event", "By"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--gp-text-subtle)", fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {own.map((x) => (
                    <tr key={x.id} style={{ borderTop: "1px solid var(--gp-hairline)" }}>
                      <td className="gp-mono" style={{ padding: "8px 10px" }}>
                        {x.locator}
                      </td>
                      <td className="gp-mono" style={{ padding: "8px 10px" }}>
                        {x.source_time?.slice(11, 19) ?? "—"}
                      </td>
                      <td className="gp-mono" style={{ padding: "8px 10px" }}>
                        {localTime(x.normalized_time)}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{x.description}</td>
                      <td style={{ padding: "8px 10px" }} className={w.muted}>
                        {x.extracted_by ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {RECORDINGS.has(item.type) && item.clock.method === "not_set" && (
                <p className={w.muted} style={{ marginTop: 12 }}>
                  This recording&apos;s clock is not verified yet.{" "}
                  <Link href={`/cases/${caseId}/evidence?e=${item.id}#clock`}>Set its clock →</Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
