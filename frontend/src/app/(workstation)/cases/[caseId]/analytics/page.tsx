import Link from "next/link";
import panel from "@/components/panel.module.css";
import { ActivityChart, ClaimsChart, ClockChart, ConflictTable, HeatmapChart, ReliabilityChart } from "@/features/analytics/Charts";
import w from "@/features/workbench/workbench.module.css";
import { analyse, STATE_ORDER } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ source?: string; state?: string }>;
}) {
  const { caseId } = await params;
  const filters = await searchParams;
  let data;
  try {
    data = await Promise.all([api.timeline(caseId), api.evidence(caseId), api.claims(caseId), api.conflicts(caseId), api.audit(caseId)]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load analytics: {message}
      </p>
    );
  }
  const [events, evidence, claims, conflicts, audit] = data;
  const source = evidence.some((e) => e.id === filters.source) ? filters.source : undefined;
  const state = (STATE_ORDER as string[]).includes(filters.state ?? "") ? filters.state : undefined;
  const a = analyse(events, evidence, claims, conflicts, audit, { source, state });
  const filtered = Boolean(source || state);

  const kpis: [string, string, string][] = [
    ["Events", String(a.kpis.events), `across ${a.kpis.sources} source${a.kpis.sources === 1 ? "" : "s"}`],
    ["Supported", `${a.kpis.supportedPct}%`, "of the events shown"],
    ["Time-corrected", String(a.kpis.corrected), "events moved by a clock offset"],
    ["Decided", `${a.kpis.decided} / ${a.kpis.conflicts}`, "conflicts with a decision"],
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-6)" }}>
      <div className={w.row} style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="gp-eyebrow">{caseId} · analytics</p>
          <h1 className={panel.pageTitle}>What the evidence shows</h1>
        </div>
        <div className={w.row}>
          <a href={`/cases/${caseId}/export?format=xlsx`} className="gp-btn gp-btn-ghost" download>
            Download for Power BI / Tableau
          </a>
          <a href={`/cases/${caseId}/export?format=zip`} className="gp-btn gp-btn-quiet" download>
            CSV files
          </a>
        </div>
      </div>

      <form method="get" className={`${w.row} ${w.form}`} style={{ flexDirection: "row" }} aria-label="Analytics filters">
        <label className={w.inline}>
          <span className={w.muted}>Source</span>
          <select name="source" defaultValue={source ?? ""}>
            <option value="">All sources</option>
            {evidence.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} · {e.source_name}
              </option>
            ))}
          </select>
        </label>
        <label className={w.inline}>
          <span className={w.muted}>State</span>
          <select name="state" defaultValue={state ?? ""}>
            <option value="">All states</option>
            {STATE_ORDER.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button className="gp-btn gp-btn-quiet">Apply</button>
        {filtered && <Link href={`/cases/${caseId}/analytics`}>Clear</Link>}
        <span className={w.muted}>Every chart follows these filters.</span>
      </form>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--gp-space-4)" }}>
        {kpis.map(([label, value, note]) => (
          <li key={label} className={panel.panel}>
            <span className="gp-mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gp-text-subtle)" }}>
              {label}
            </span>
            <p className="gp-mono" style={{ fontSize: "2.2rem", margin: "4px 0" }}>
              {value}
            </p>
            <span className={w.muted}>{note}</span>
          </li>
        ))}
      </ul>

      <div className={w.split} style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" }}>
        <div className={panel.panel}>
          <ActivityChart a={a} />
        </div>
        <div className={panel.panel}>
          <ReliabilityChart a={a} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--gp-space-4)" }}>
        <div className={panel.panel}>
          <ClaimsChart a={a} />
        </div>
        <div className={panel.panel}>
          <ClockChart a={a} />
        </div>
        <div className={panel.panel}>
          <ConflictTable a={a} />
        </div>
      </div>

      <div className={panel.panel}>
        <HeatmapChart a={a} />
      </div>

      <p className={w.muted}>
        The download is an Excel workbook: in Power BI choose <em>Get data → Excel workbook</em>, in Tableau{" "}
        <em>Connect → Microsoft Excel</em>. Sheets join on their <code>*_id</code> columns; times are UTC.
      </p>
    </section>
  );
}
