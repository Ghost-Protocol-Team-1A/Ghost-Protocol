import { describe, expect, it } from "vitest";
import { buildGraph, neighbours } from "./graph";
import type { Claim, Conflict, EvidenceItem, Hypothesis, TimelineEvent } from "./types";

const ev = (id: string, evidence_id: string, locator: string) =>
  ({ id, evidence_id, locator, description: id, normalized_time: "2026-10-10T20:12:00Z", state: "supported" }) as TimelineEvent;

const evidence = [
  { id: "E-04", source_name: "Door access log", type: "csv", simulated: false },
  { id: "E-05", source_name: "Inventory log", type: "csv", simulated: false },
] as EvidenceItem[];
const events = [ev("EV-012", "E-04", "row 18"), ev("EV-009", "E-05", "row 7")];
const claims = [
  {
    id: "CL-05",
    statement: "A separate door event happened at 21:09:00",
    kind: "event",
    state: "contradicted",
    links: [
      { evidence_id: "E-05", locator: "row 7", relationship: "supports" },
      { evidence_id: "E-04", locator: "rows 17-18", relationship: "contradicts" },
    ],
  },
  { id: "CL-04", statement: "Who", kind: "identity", state: "unresolved", links: [] },
] as unknown as Claim[];
const hypotheses = [] as Hypothesis[];
const conflicts = [
  { id: "C-01", rule_id: "RULE-DUP-001", type: "copied_record", evidence_ids: ["E-04", "E-05"], event_ids: ["EV-012", "EV-009"], status: "open", explanation: "" },
  { id: "C-03", rule_id: "RULE-CLAIM-001", type: "identity_not_established", evidence_ids: [], event_ids: [], status: "open", explanation: "No source supports it (CL-04)." },
] as unknown as Conflict[];

describe("buildGraph", () => {
  const g = buildGraph("CASE-001", evidence, events, claims, hypotheses, conflicts);
  const has = (from: string, to: string, kind: string) =>
    g.edges.some((e) => e.from === from && e.to === to && e.kind === kind);

  it("links evidence to the events extracted from it", () => {
    expect(has("E-04", "EV-012", "extracted")).toBe(true);
  });

  it("links a claim to the exact event when the locator matches, else to the evidence", () => {
    expect(has("EV-009", "CL-05", "supports")).toBe(true);
    expect(has("E-04", "CL-05", "contradicts")).toBe(true);
  });

  it("joins conflicts to the records they compared, and identity conflicts to their claim", () => {
    expect(has("EV-012", "C-01", "conflict")).toBe(true);
    expect(has("EV-009", "C-01", "conflict")).toBe(true);
    expect(has("CL-04", "C-03", "conflict")).toBe(true);
  });

  it("gives every node a link into the workstation", () => {
    const href = Object.fromEntries(g.nodes.map((n) => [n.id, n.href]));
    expect(href["E-04"]).toBe("/cases/CASE-001/evidence?e=E-04");
    expect(href["EV-009"]).toBe("/cases/CASE-001/timeline?ev=EV-009");
    expect(href["C-01"]).toBe("/cases/CASE-001/conflicts?c=C-01");
    expect(href["CL-04"]).toBe("/cases/CASE-001/report#unresolved");
  });

  it("finds a node's neighbours", () => {
    expect([...neighbours(g, "C-01")].sort()).toEqual(["C-01", "EV-009", "EV-012"]);
  });
});
