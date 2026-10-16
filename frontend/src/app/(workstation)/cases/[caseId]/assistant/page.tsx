import panel from "@/components/panel.module.css";
import { AskPanel, BriefingPanel } from "@/features/workbench/Forms";
import w from "@/features/workbench/workbench.module.css";
import { api, ApiError } from "@/lib/api";

export default async function AssistantPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  let data;
  try {
    data = await Promise.all([api.briefing(caseId), api.aiStatus().catch(() => ({ configured: false, model: "claude-sonnet-5-5" }))]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the assistant: {message}
      </p>
    );
  }
  const [briefing, ai] = data;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-6)" }}>
      <div className={w.row} style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="gp-eyebrow">{caseId} · AI assistant</p>
          <h1 className={panel.pageTitle}>Case briefing</h1>
          <p className={panel.pageLead}>
            Claude reads this case&apos;s records and pulls them together. Every point cites a record you can open;
            points citing anything that does not exist are removed before you see them.
          </p>
        </div>
        <span className={w.aiTag}>
          {ai.model} · {ai.configured ? "on" : "off"} · cited · you decide
        </span>
      </div>

      <div className={w.split}>
        <div className={`${panel.panel} ${w.ai}`}>
          <BriefingPanel caseId={caseId} initial={briefing} configured={ai.configured} />
        </div>
        <div className={panel.panel}>
          <AskPanel caseId={caseId} configured={ai.configured} />
        </div>
      </div>
    </section>
  );
}
