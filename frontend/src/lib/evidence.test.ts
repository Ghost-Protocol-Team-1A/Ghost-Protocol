import { describe, expect, it } from "vitest";
import { clockLabel, extractionLabel, formatBytes, rowsWithEvents } from "./evidence";
import type { TimelineEvent } from "./types";

const ev = (id: string, evidence_id: string, locator: string) =>
  ({ id, evidence_id, locator }) as TimelineEvent;

describe("evidence helpers", () => {
  it("maps original rows to the events extracted from them", () => {
    const map = rowsWithEvents(
      [ev("EV-012", "E-04", "row 18"), ev("EV-009", "E-05", "row 7"), ev("EV-011", "E-01", "timecode 00:14")],
      "E-04",
    );
    expect([...map]).toEqual([["18", "EV-012"]]);
  });

  it("describes clock assumptions in plain language", () => {
    expect(clockLabel({ offset_seconds: 120, method: "declared_in_fixture_metadata", note: "" })).toBe(
      "Runs 120 s fast · declared demo assumption",
    );
    expect(clockLabel({ offset_seconds: 120, method: "inferred_from_anchors", note: "" })).toBe(
      "Runs 120 s fast · inferred from anchors",
    );
    expect(clockLabel({ offset_seconds: 0, method: "reference_clock", note: "" })).toBe(
      "Reference clock · no offset",
    );
  });

  it("formats sizes", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("says when extraction has not run on an upload", () => {
    expect(extractionLabel({ processing_status: "queued", simulated: true, type: "audio" })).toMatch(/Not run yet/);
    expect(extractionLabel({ processing_status: "extracted", simulated: true, type: "video" })).toBe(
      "Simulated from seed metadata",
    );
    expect(extractionLabel({ processing_status: "extracted", simulated: false, type: "csv" })).toBe(
      "Deterministic CSV parser",
    );
  });
});
