import Link from "next/link";
import panel from "@/components/panel.module.css";
import { ConclusionForm } from "@/features/workbench/Forms";
import { Stepper } from "@/features/workbench/Stepper";
import w from "@/features/workbench/workbench.module.css";
import { api, ApiError } from "@/lib/api";
import { currentIdentity } from "@/lib/session";

const FINDING = {
  established: "Established",
  partly_established: "Partly established",
  not_established: "Not established",
} as const;

export default async function ConclusionPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  let data;
  try {
    data = await Promise.all([
      api.journey(caseId),
      api.questions(caseId),
      api.claims(caseId),
      api.conflicts(caseId),
      api.conclusions(caseId),
      api.aiStatus().catch(() => ({ configured: false, model: "" })),
    ]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the conclusion: {message}
      </p>
    );
  }
  const [journey, questions, claims, conflicts, conclusions, ai] = data;
  const identity = await currentIdentity();
  const open = conflicts.filter((c) => c.status === "open");
  const latest = conclusions.at(-1);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-6)" }}>
      <div>
        <p className="gp-eyebrow">Step 6 · Conclusion</p>
        <h1 className={panel.pageTitle}>Answer each question, then sign</h1>
        <p className={panel.pageLead}>
          A person decides. The AI can draft wording from accepted facts; the signature, and the responsibility, are
          yours. Signing again creates a new version; earlier ones stay on record.
        </p>
      </div>
      <Stepper journey={journey} />

      {latest && (
        <div className={panel.panel} style={{ borderColor: "var(--gp-lime)" }}>
          <div className={w.row} style={{ justifyContent: "space-between" }}>
            <h2 className={panel.panelTitle}>
              Signed by {latest.signed_by} ({latest.role}) · version {latest.version}
            </h2>
            <Link href={`/cases/${caseId}/report`} className="gp-btn gp-btn-ghost">
              Open the report
            </Link>
          </div>
          <p className={w.muted}>
            {latest.signed_at.slice(0, 16).replace("T", " ")} UTC{latest.supersedes ? ` · supersedes ${latest.supersedes}` : ""}
          </p>
          <ul className={w.list} style={{ marginTop: 12 }}>
            {latest.answers.map((a) => (
              <li key={a.question_id}>
                <strong>
                  <span className="gp-mono" style={{ color: "var(--gp-lime)" }}>
                    {a.question_id}
                  </span>{" "}
                  {FINDING[a.finding]}
                </strong>
                <p style={{ margin: "4px 0" }}>{a.text}</p>
                {a.cites.map((c) => (
                  <span key={c} className={w.cite}>
                    {c}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {open.length > 0 && (
        <div className={panel.panel}>
          <p className={w.error}>
            {open.length} conflict{open.length === 1 ? " is" : "s are"} still open ({open.map((c) => c.id).join(", ")}). Decide{" "}
            {open.length === 1 ? "it" : "them"} in the <Link href={`/cases/${caseId}/conflicts?c=${open[0].id}`}>conflict inspector</Link>{" "}
            before signing.
          </p>
        </div>
      )}

      {questions.length === 0 ? (
        <div className={panel.panel}>
          <p className={w.muted}>
            There is nothing to answer yet. <Link href={`/cases/${caseId}/questions`}>Write the case questions →</Link>
          </p>
        </div>
      ) : (
        <div className={panel.panel}>
          <h2 className={panel.panelTitle}>{latest ? "Sign a new version" : "Answers"}</h2>
          <ConclusionForm caseId={caseId} questions={questions} claims={claims} configured={ai.configured} signedIn={Boolean(identity)} />
        </div>
      )}
    </section>
  );
}
