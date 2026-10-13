import { describe, expect, it } from "vitest";
import { metrics, offsetEvents, pad } from "./dashboard";
import type { CaseSummary, Claim, TimelineEvent } from "./types";

describe("dashboard helpers", () => {
  it("adds up evidence and conflicts across cases and counts unresolved claims", () => {
    const cases = [
      { evidence_count: 6, open_conflicts: 3 },
      { evidence_count: 5, open_conflicts: 1 },
    ] as CaseSummary[];
    const claims = [{ state: "unresolved" }, { state: "supported" }, { state: "unresolved" }] as Claim[];
    expect(metrics(cases, claims)).toEqual({
      cases: 2,
      evidence: 11,
      openConflicts: 4,
      unresolvedClaims: 2,
    });
  });

  it("counts events adjusted for a clock offset", () => {
    const events = [{ offset_seconds: 120 }, { offset_seconds: 0 }] as TimelineEvent[];
    expect(offsetEvents(events)).toBe(1);
  });

  it("pads counts to two digits", () => {
    expect(pad(4)).toBe("04");
    expect(pad(12)).toBe("12");
  });
});
