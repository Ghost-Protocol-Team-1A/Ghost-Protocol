"use client";

import { useState } from "react";
import { COLUMNS, type Graph, type GraphNode, neighbours } from "@/lib/graph";
import styles from "./graph.module.css";

const COL_X = [0, 330, 660, 990];
const NODE_W = 250;
const NODE_H = 54;
const ROW_H = 66;
const TOP = 40;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function EvidenceGraph({ graph }: { graph: Graph }) {
  const [active, setActive] = useState<string | null>(null);
  const lit = active ? neighbours(graph, active) : null;

  const count = (col: number) => graph.nodes.filter((n) => n.column === col).length;
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of graph.nodes) {
    const offset = ((graph.rows - count(n.column)) * ROW_H) / 2;
    pos.set(n.id, { x: COL_X[n.column], y: TOP + offset + n.row * ROW_H });
  }
  const width = COL_X[3] + NODE_W;
  const height = TOP + graph.rows * ROW_H;

  const nodeClass = (n: GraphNode) =>
    [styles.node, styles[n.kind], n.state ? styles[n.state] : "", lit && !lit.has(n.id) ? styles.dim : ""].join(" ");

  return (
    <div className={styles.scroller}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.svg}
        role="img"
        aria-label="Evidence graph: evidence, the events extracted from it, the claims and hypotheses they support or contradict, and the conflicts between them"
      >
        {COLUMNS.map((label, i) => (
          <text key={label} x={COL_X[i]} y={16} className={styles.colLabel}>
            {label.toUpperCase()}
          </text>
        ))}

        <g aria-hidden="true">
          {graph.edges.map((e) => {
            const a = pos.get(e.from)!;
            const b = pos.get(e.to)!;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            const on = !lit || (lit.has(e.from) && lit.has(e.to) && (e.from === active || e.to === active));
            return (
              <path
                key={`${e.from}>${e.to}`}
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                className={`${styles.edge} ${styles[`edge_${e.kind}`]} ${on ? "" : styles.dimEdge} ${lit && on ? styles.hot : ""}`}
              />
            );
          })}
        </g>

        {graph.nodes.map((n) => {
          const p = pos.get(n.id)!;
          return (
            <a
              key={n.id}
              href={n.href}
              className={nodeClass(n)}
              onMouseEnter={() => setActive(n.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive(null)}
              aria-label={`${n.title}: ${n.subtitle}`}
            >
              <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={12} />
              {n.state && <circle cx={p.x + 16} cy={p.y + 18} r={5} className={styles.stateDot} />}
              <text x={p.x + (n.state ? 28 : 14)} y={p.y + 22} className={styles.title}>
                {truncate(n.title, 30)}
              </text>
              <text x={p.x + 14} y={p.y + 40} className={styles.sub}>
                {truncate(n.subtitle, 36)}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
