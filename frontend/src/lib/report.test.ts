import { describe, expect, it } from "vitest";
import { reportChecks } from "./report";
import type { Claim, Conflict, EvidenceItem, TimelineEvent } from "./types";

describe("reportChecks", () => {
  it("reports linked events, uncited claims and unreviewed conflicts honestly", () => {
    const evidence = [{ id: "E-01" }] as EvidenceItem[];
    const events = [{ evidence_id: "E-01" }, { evidence_id: "E-99" }] as TimelineEvent[];
    const conflicts = [{ status: "open" }, { status: "resolved" }] as Conflict[];
    const claims = [
      { state: "supported", links: [] },
      { state: "unresolved", links: [] },
    ] as unknown as Claim[];

    const checks = Object.fromEntries(reportChecks(events, evidence, conflicts, claims).map((c) => [c.label, c]));
    expect(checks["Events linked to a source"]).toMatchObject({ value: "1 / 2", ok: false });
    expect(checks["Claims citing evidence"]).toMatchObject({ value: "1 missing", ok: false });
    expect(checks["Conflicts reviewed"]).toMatchObject({ value: "1 / 2", ok: false });
    expect(checks["Unknowns disclosed"].value).toBe("1 unresolved listed");
    expect(checks["Human approval"].ok).toBe(false);
  });
});
