import { describe, expect, it } from "vitest";
import { analyse } from "./analytics";
import type { AuditEvent, Claim, Conflict, EvidenceItem, TimelineEvent } from "./types";

const ev = (id: string, evidence_id: string, minute: number, state: TimelineEvent["state"] = "supported", offset = 0) =>
  ({ id, evidence_id, state, offset_seconds: offset, normalized_time: `2026-10-10T20:${String(minute).padStart(2, "0")}:00Z` }) as TimelineEvent;
const item = (id: string, offset = 0, simulated = false) =>
  ({ id, source_name: `Source ${id}`, simulated, clock: { offset_seconds: offset, method: offset ? "inferred_from_anchors" : "reference_clock", note: "" } }) as EvidenceItem;

const events = [ev("a", "E-01", 0), ev("b", "E-02", 6, "supported", 120), ev("c", "E-02", 12, "contradicted"), ev("d", "E-03", 12, "unresolved")];
const evidence = [item("E-01"), item("E-02", 120), item("E-03")];
const claims = [{ state: "supported" }, { state: "unresolved" }, { state: "unresolved" }] as Claim[];
const conflicts = [
  { rule_id: "RULE-DUP-001", status: "resolved" },
  { rule_id: "RULE-TIME-002", status: "open" },
] as Conflict[];
const audit = [
  { actor: "BJ", at: "2026-10-11T09:00:00Z" },
  { actor: "BJ", at: "2026-10-11T09:30:00Z" },
  { actor: "Femi", at: "2026-10-11T15:00:00Z" },
] as AuditEvent[];

describe("analyse", () => {
  const a = analyse(events, evidence, claims, conflicts, audit, {}, 3);

  it("counts headline numbers", () => {
    expect(a.kpis).toEqual({ events: 4, sources: 3, supportedPct: 50, corrected: 1, decided: 1, conflicts: 2 });
  });

  it("bins activity per source across the shown span", () => {
    expect(a.activity.map((r) => r.bins)).toEqual([
      [1, 0, 0],
      [0, 1, 1],
      [0, 0, 1],
    ]);
  });

  it("breaks each source down by state and skips empty ones", () => {
    expect(a.reliability.find((r) => r.evidenceId === "E-02")?.counts).toEqual({ contradicted: 1, unresolved: 0, inferred: 0, supported: 1 });
  });

  it("summarises claims, clocks, conflicts and who acted when", () => {
    expect(a.claims.unresolved).toBe(2);
    expect(a.clocks.find((c) => c.evidenceId === "E-02")?.offset).toBe(120);
    expect(a.conflicts).toEqual([
      { rule: "RULE-DUP-001", open: 0, decided: 1 },
      { rule: "RULE-TIME-002", open: 1, decided: 0 },
    ]);
    expect(a.heat.find((h) => h.actor === "BJ")?.hours[9]).toBe(2);
  });

  it("follows the filters", () => {
    const only = analyse(events, evidence, claims, conflicts, audit, { source: "E-02" }, 3);
    expect(only.kpis.events).toBe(2);
    expect(only.activity.map((r) => r.evidenceId)).toEqual(["E-02"]);
    const unresolved = analyse(events, evidence, claims, conflicts, audit, { state: "unresolved" }, 3);
    expect(unresolved.kpis.events).toBe(1);
    expect(unresolved.claims.supported).toBe(0);
  });
});
