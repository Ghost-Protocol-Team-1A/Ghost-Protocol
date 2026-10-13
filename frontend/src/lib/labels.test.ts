import { describe, expect, it } from "vitest";
import { conflictTitle, selectConflict } from "./labels";
import type { Conflict } from "./types";

const base: Conflict = {
  id: "C-01",
  case_id: "CASE-001",
  type: "copied_record",
  rule_id: "RULE-DUP-001",
  severity: "high",
  evidence_ids: ["E-04", "E-05"],
  event_ids: ["EV-012", "EV-009"],
  explanation: "",
  detection_method: "",
  uncertain: "",
  status: "open",
  requires_human_review: true,
};
const offset: Conflict = { ...base, id: "C-02", type: "clock_offset", evidence_ids: ["E-02"] };

describe("conflict labels", () => {
  it("names the evidence for a clock offset", () => {
    expect(conflictTitle(offset)).toBe("Camera clock offset · E-02");
    expect(conflictTitle(base)).toBe("Copied log out of sequence");
  });

  it("selects the requested conflict or the first one", () => {
    expect(selectConflict([base, offset], "C-02")?.id).toBe("C-02");
    expect(selectConflict([base, offset], "C-99")?.id).toBe("C-01");
    expect(selectConflict([], "C-01")).toBeUndefined();
  });
});
