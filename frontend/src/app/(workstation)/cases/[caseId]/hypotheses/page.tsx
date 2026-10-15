import Link from "next/link";
import { StateBadge } from "@/components/StateBadge";
import { ReviewForm, ReviewHistory } from "@/features/review/ReviewForm";
import panel from "@/components/panel.module.css";
import { api, ApiError } from "@/lib/api";
import type { EvidenceItem, EvidenceLink } from "@/lib/types";
import styles from "./hypotheses.module.css";

function LinkList({
  links,
  evidence,
  empty,
}: {
  links: EvidenceLink[];
  evidence: Map<string, EvidenceItem>;
  empty: string;
}) {
  if (links.length === 0) return <p className={styles.none}>{empty}</p>;
  return (
    <ul className={styles.links}>
      {links.map((l) => (
        <li key={`${l.evidence_id}-${l.locator}`}>
          <strong>{l.evidence_id}</strong> {evidence.get(l.evidence_id)?.source_name}
          {l.locator && <span className={styles.locator}> · {l.locator}</span>}
        </li>
      ))}
    </ul>
  );
}

export default async function HypothesesPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { caseId } = await params;
  const { c: conflictId } = await searchParams;

  let data;
  try {
    data = await Promise.all([api.hypotheses(caseId), api.evidence(caseId)]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load hypotheses: {message}
      </p>
    );
  }
  const [all, evidence] = data;
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const hypotheses = conflictId ? all.filter((h) => h.conflict_id === conflictId) : all;
  const questions = [...new Set(hypotheses.map((h) => h.question))];

  return (
    <section>
      <h1 className={panel.pageTitle}>Hypothesis comparison</h1>
      <p className={panel.pageLead}>
        Compare plausible explanations without collapsing uncertainty into a single verdict.
      </p>

      {hypotheses.length === 0 && (
        <p className={styles.none}>No hypotheses recorded{conflictId ? ` for ${conflictId}` : ""}.</p>
      )}

      {questions.map((question) => (
        <div key={question} className={styles.group}>
          <div className={`${panel.panel} ${styles.question}`}>
            <h2 className={styles.questionText}>Question: {question}</h2>
            <p className={styles.notice}>
              Hypotheses are provisional. They are not findings of guilt or proof of manipulation.
              No probability is assigned.
            </p>
          </div>

          {hypotheses
            .filter((h) => h.question === question)
            .map((h) => {
              const supporting = h.links.filter((l) => l.relationship === "supports");
              const contradicting = h.links.filter((l) => l.relationship === "contradicts");
              return (
                <article key={h.id} className={`${panel.panel} ${styles.card}`}>
                  <header className={styles.cardHeader}>
                    <span className={styles.id}>{h.id}</span>
                    <StateBadge state={h.state} />
                  </header>
                  <h3 className={styles.title}>{h.description}</h3>
                  <p className={styles.notes}>{h.notes}</p>
                  <div className={styles.columns}>
                    <div>
                      <h4 className={styles.colTitle}>Supporting evidence</h4>
                      <LinkList
                        links={supporting}
                        evidence={evidenceById}
                        empty="No source supports this."
                      />
                    </div>
                    <div>
                      <h4 className={styles.colTitle}>Contradicting evidence</h4>
                      <LinkList
                        links={contradicting}
                        evidence={evidenceById}
                        empty="No source contradicts this."
                      />
                    </div>
                  </div>
                  <ReviewHistory reviews={h.reviews} />
                  <ReviewForm caseId={caseId} targetId={h.id} />
                  {h.conflict_id && (
                    <Link href={`/cases/${caseId}/conflicts?c=${h.conflict_id}`}>
                      View conflict {h.conflict_id} →
                    </Link>
                  )}
                </article>
              );
            })}
        </div>
      ))}
    </section>
  );
}
