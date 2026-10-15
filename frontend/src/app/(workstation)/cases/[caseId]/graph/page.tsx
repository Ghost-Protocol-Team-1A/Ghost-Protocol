import panel from "@/components/panel.module.css";
import { EvidenceGraph } from "@/features/graph/EvidenceGraph";
import { api, ApiError } from "@/lib/api";
import { buildGraph } from "@/lib/graph";
import styles from "./page.module.css";

export default async function GraphPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;

  let data;
  try {
    data = await Promise.all([
      api.evidence(caseId),
      api.timeline(caseId),
      api.claims(caseId),
      api.hypotheses(caseId),
      api.conflicts(caseId),
    ]);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load the graph: {message}
      </p>
    );
  }
  const graph = buildGraph(caseId, ...data);

  return (
    <section>
      <p className="gp-eyebrow">{caseId} · evidence graph</p>
      <h1 className={panel.pageTitle}>How the evidence connects</h1>
      <p className={panel.pageLead}>
        Evidence, the events extracted from it, the claims and hypotheses those events support or
        contradict, and the conflicts the rules raised. Point at a node to see what it touches; select
        it to open the record.
      </p>
      <div className={`${panel.panel} ${styles.board}`}>
        <EvidenceGraph graph={graph} />
      </div>
      <p className={styles.legend}>
        <span>
          <i className={styles.solid} /> extracted from
        </span>
        <span>
          <i className={styles.lime} /> supports
        </span>
        <span>
          <i className={styles.dashed} /> contradicts or in conflict
        </span>
        <span>
          {graph.nodes.length} nodes · {graph.edges.length} links
        </span>
      </p>
    </section>
  );
}
