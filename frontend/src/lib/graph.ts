import { localTime } from "./api";
import type { Claim, ClaimState, Conflict, EvidenceItem, EvidenceLink, Hypothesis, TimelineEvent } from "./types";

export type NodeKind = "evidence" | "event" | "claim" | "conflict";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  column: number;
  row: number;
  title: string;
  subtitle: string;
  state: ClaimState | null;
  href: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** extracted: evidence -> event; supports/contradicts: source -> claim; conflict: event -> conflict. */
  kind: "extracted" | "supports" | "contradicts" | "conflict";
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rows: number;
}

export const COLUMNS = ["Evidence", "Events", "Claims & hypotheses", "Conflicts"] as const;

/** A claim link points at the event with the same evidence and locator, else at the evidence. */
function linkSource(link: EvidenceLink, events: TimelineEvent[]): string {
  const event = events.find((e) => e.evidence_id === link.evidence_id && e.locator === link.locator);
  return event ? event.id : link.evidence_id;
}

/** Evidence -> events -> claims and hypotheses, with conflicts joined to the records they compared. */
export function buildGraph(
  caseId: string,
  evidence: EvidenceItem[],
  events: TimelineEvent[],
  claims: Claim[],
  hypotheses: Hypothesis[],
  conflicts: Conflict[],
): Graph {
  const base = `/cases/${caseId}`;
  const nodes: GraphNode[] = [
    ...evidence.map((e, row) => ({
      id: e.id,
      kind: "evidence" as const,
      column: 0,
      row,
      title: `${e.id} · ${e.source_name}`,
      subtitle: e.simulated ? `${e.type} · simulated` : `${e.type} · hashed`,
      state: null,
      href: `${base}/evidence?e=${e.id}`,
    })),
    ...events.map((e, row) => ({
      id: e.id,
      kind: "event" as const,
      column: 1,
      row,
      title: `${e.id} · ${localTime(e.normalized_time).slice(0, 5)}`,
      subtitle: e.description,
      state: e.state,
      href: `${base}/timeline?ev=${e.id}`,
    })),
    ...[...claims, ...hypotheses].map((c, row) => ({
      id: c.id,
      kind: "claim" as const,
      column: 2,
      row,
      title: c.id,
      subtitle: "statement" in c ? c.statement : c.description,
      state: c.state,
      href:
        "statement" in c
          ? `${base}/report#${c.state === "unresolved" ? "unresolved" : "timeline"}`
          : `${base}/hypotheses?c=${c.conflict_id ?? ""}`,
    })),
    ...conflicts.map((c, row) => ({
      id: c.id,
      kind: "conflict" as const,
      column: 3,
      row,
      title: `${c.id} · ${c.rule_id}`,
      subtitle: c.status.replace("_", " "),
      state: null,
      href: `${base}/conflicts?c=${c.id}`,
    })),
  ];

  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const add = (edge: GraphEdge) => {
    const key = `${edge.from}>${edge.to}`;
    if (ids.has(edge.from) && ids.has(edge.to) && !seen.has(key)) {
      seen.add(key);
      edges.push(edge);
    }
  };

  for (const e of events) add({ from: e.evidence_id, to: e.id, kind: "extracted" });
  for (const c of [...claims, ...hypotheses]) {
    for (const link of c.links) add({ from: linkSource(link, events), to: c.id, kind: link.relationship });
  }
  for (const c of conflicts) {
    const sources = c.event_ids.length ? c.event_ids : c.evidence_ids;
    for (const s of sources) add({ from: s, to: c.id, kind: "conflict" });
  }
  // Identity conflicts point at no record; join them to the claim they are about.
  for (const c of conflicts.filter((x) => x.type === "identity_not_established")) {
    const claim = claims.find((x) => x.kind === "identity" && c.explanation.includes(x.id));
    if (claim) add({ from: claim.id, to: c.id, kind: "conflict" });
  }

  const rows = Math.max(...[0, 1, 2, 3].map((col) => nodes.filter((n) => n.column === col).length), 1);
  return { nodes, edges, rows };
}

/** Every node joined to `id` by an edge, plus `id` itself. */
export function neighbours(graph: Graph, id: string): Set<string> {
  const out = new Set([id]);
  for (const e of graph.edges) {
    if (e.from === id) out.add(e.to);
    if (e.to === id) out.add(e.from);
  }
  return out;
}
