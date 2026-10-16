import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import panel from "@/components/panel.module.css";
import { Stepper } from "@/features/workbench/Stepper";
import w from "@/features/workbench/workbench.module.css";
import { api, ApiError } from "@/lib/api";

export default async function CaseOverviewPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  let data;
  try {
    data = await Promise.all([
      api.case(caseId),
      api.journey(caseId),
      api.evidence(caseId),
      api.conflicts(caseId),
      api.questions(caseId),
      api.briefing(caseId),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the case: {message}
      </p>
    );
  }
  const [summary, journey, evidence, conflicts, questions, briefing] = data;
  const c = summary.case;
  const open = conflicts.filter((x) => x.status === "open").length;
  const doneSteps = journey.steps.filter((s) => s.done).length;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-6)" }}>
      <div className={w.row} style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="gp-eyebrow">
            {c.id} · {c.fictional ? "fictional" : c.classification}
          </p>
          <h1 className={panel.pageTitle}>{c.title}</h1>
          {c.scope && <p className={panel.pageLead}>{c.scope}</p>}
        </div>
        <span className="gp-chip gp-chip-lime">
          {doneSteps} of {journey.steps.length} steps done
        </span>
      </div>

      <Stepper journey={journey} />

      <div className={w.split}>
        <div className={`${panel.panel} ${w.next}`}>
          <span className="gp-eyebrow">Next step</span>
          <h2 className={w.nextTitle}>{journey.next_label}</h2>
          <p className={w.muted}>{journey.next_detail}</p>
          <div className={w.row}>
            <Link href={journey.next_href} className="gp-btn gp-btn-lime">
              Go <Icon name="arrow" size={16} />
            </Link>
            <Link href={`/cases/${c.id}/assistant`} className="gp-btn gp-btn-ghost">
              <Icon name="ai" size={16} /> Ask the AI about this case
            </Link>
          </div>
        </div>

        <div className={panel.panel}>
          <h2 className={panel.panelTitle}>Progress</h2>
          <ul className={w.checklist}>
            {journey.steps.map((s) => (
              <li key={s.key} className={s.done ? w.checkDone : s.key === journey.current ? w.checkHere : undefined}>
                <Link href={s.href} style={{ color: "inherit" }}>
                  {s.label}
                </Link>
                <span className={w.muted}> · {s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="metrics" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--gp-space-4)" }}>
        {[
          ["Evidence", summary.evidence_count, `${evidence.filter((e) => e.sha256).length} hashed files`],
          ["Events", summary.event_count, "on the timeline"],
          ["Open conflicts", open, `${conflicts.length - open} decided`],
          ["Questions", questions.length, "the case must answer"],
        ].map(([label, value, note]) => (
          <li key={label as string} className={panel.panel}>
            <span className="gp-mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gp-text-subtle)" }}>
              {label}
            </span>
            <p className="gp-mono" style={{ fontSize: "2.5rem", margin: "4px 0" }}>
              {String(value).padStart(2, "0")}
            </p>
            <span className={w.muted}>{note}</span>
          </li>
        ))}
      </ul>

      <div className={`${panel.panel} ${w.ai}`}>
        <div className={w.row} style={{ justifyContent: "space-between" }}>
          <h2 className={panel.panelTitle}>AI briefing</h2>
          <span className={w.aiTag}>Cited · you decide</span>
        </div>
        {briefing ? (
          <>
            <ul className={w.list} style={{ marginTop: "var(--gp-space-3)" }}>
              {briefing.summary.slice(0, 3).map((p) => (
                <li key={p.text}>
                  <p style={{ margin: 0 }}>{p.text}</p>
                  {p.cites.map((cite) => (
                    <span key={cite} className={w.cite}>
                      {cite}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <Link href={`/cases/${c.id}/assistant`}>Read the full briefing →</Link>
          </>
        ) : (
          <p className={w.muted} style={{ marginTop: "var(--gp-space-2)" }}>
            No briefing yet. <Link href={`/cases/${c.id}/assistant`}>Compile one</Link> from this case&apos;s records; every
            point will cite them.
          </p>
        )}
      </div>
    </section>
  );
}
