import Link from "next/link";
import { StateBadge } from "@/components/StateBadge";
import panel from "@/components/panel.module.css";
import { ClaimForm, QuestionForm } from "@/features/workbench/Forms";
import w from "@/features/workbench/workbench.module.css";
import { api, ApiError } from "@/lib/api";

export default async function QuestionsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  let data;
  try {
    data = await Promise.all([api.journey(caseId), api.questions(caseId), api.claims(caseId), api.evidence(caseId)]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load questions: {message}
      </p>
    );
  }
  const [journey, questions, claims, evidence] = data;
  const loose = claims.filter((c) => !c.question_id);
  const firstEmpty = questions.find((q) => !claims.some((c) => c.question_id === q.id));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-6)" }}>
      <div>
        <p className="gp-eyebrow">Step 5 · Questions &amp; claims</p>
        <h1 className={panel.pageTitle}>What must this case establish?</h1>
        <p className={panel.pageLead}>
          Write the questions first. Then attach claims, each with the evidence it rests on. A claim&apos;s state has to
          match its citations, so nothing is called supported without a source.
        </p>
      </div>

      <div className={w.split}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-4)" }}>
          {questions.length === 0 && (
            <div className={panel.panel}>
              <p className={w.muted}>No questions yet. Add the first one on the right.</p>
            </div>
          )}
          {questions.map((q) => {
            const related = claims.filter((c) => c.question_id === q.id);
            return (
              <article key={q.id} className={panel.panel} aria-labelledby={`${q.id}-h`}>
                <p className="gp-mono" style={{ color: "var(--gp-lime)", fontSize: "var(--gp-text-xs)", margin: 0 }}>
                  {q.id} · asked by {q.created_by}
                </p>
                <h2 id={`${q.id}-h`} className={panel.panelTitle} style={{ margin: "4px 0 12px" }}>
                  {q.text}
                </h2>
                {related.length === 0 ? (
                  <p className={w.muted}>No claim bears on this yet.</p>
                ) : (
                  <ul className={w.list}>
                    {related.map((c) => (
                      <li key={c.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <StateBadge state={c.state} />
                        <div>
                          <strong>
                            <span className="gp-mono">{c.id}</span> {c.statement}
                          </strong>
                          <p className={w.muted}>{c.rationale}</p>
                          {c.links.map((l) => (
                            <Link key={`${l.evidence_id}${l.locator}${l.relationship}`} href={`/cases/${caseId}/evidence?e=${l.evidence_id}`} className={w.cite}>
                              {l.evidence_id} {l.relationship === "contradicts" ? "✕" : "✓"} {l.locator ?? ""}
                            </Link>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
          {loose.length > 0 && (
            <div className={panel.panel}>
              <h2 className={panel.panelTitle}>Claims not tied to a question</h2>
              <ul className={w.list} style={{ marginTop: 8 }}>
                {loose.map((c) => (
                  <li key={c.id}>
                    <StateBadge state={c.state} /> <span className="gp-mono">{c.id}</span> {c.statement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-4)", position: "sticky", top: 88 }}>
          <div className={panel.panel}>
            <h2 className={panel.panelTitle}>Add a question</h2>
            <QuestionForm caseId={caseId} />
          </div>
          <div className={panel.panel}>
            <h2 className={panel.panelTitle}>Add a claim</h2>
            {evidence.length ? (
              <ClaimForm key={`${questions.length}-${claims.length}`} caseId={caseId} questions={questions} evidence={evidence} defaultQuestion={firstEmpty?.id} />
            ) : (
              <p className={w.muted}>
                Claims cite evidence. <Link href={`/cases/${caseId}/intake`}>Upload some first →</Link>
              </p>
            )}
          </div>
          {journey.steps.find((s) => s.key === "questions")?.done && (
            <Link href={`/cases/${caseId}/conclusion`} className="gp-btn gp-btn-lime" style={{ alignSelf: "flex-start" }}>
              Every question has claims · Go to conclusion
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
