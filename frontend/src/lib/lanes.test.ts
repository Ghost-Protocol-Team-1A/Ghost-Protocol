import { describe, expect, it } from "vitest";
import { buildLanes, shiftLabel } from "./lanes";
import type { EvidenceItem, TimelineEvent } from "./types";

const item = (id: string, source_name: string) => ({ id, source_name }) as EvidenceItem;

const event = (over: Partial<TimelineEvent>): TimelineEvent => ({
  id: "EV",
  case_id: "CASE-001",
  evidence_id: "E-01",
  locator: "",
  description: "",
  source_time: null,
  normalized_time: null,
  offset_seconds: 0,
  normalization_rule: "",
  approximate: false,
  uncertainty_seconds: 0,
  state: "supported",
  record: {},
  ...over,
});

const START = "2026-10-10T20:08:00Z";
const END = "2026-10-10T20:20:00Z";

describe("buildLanes", () => {
  it("positions events by normalized time and keeps where the source clock put them", () => {
    const lanes = buildLanes(
      [
        event({ id: "EV-014", evidence_id: "E-02", source_time: "2026-10-10T21:16:00+01:00", normalized_time: "2026-10-10T20:14:00Z", offset_seconds: 120 }),
        event({ id: "EV-011", evidence_id: "E-01", source_time: "2026-10-10T21:10:00+01:00", normalized_time: "2026-10-10T20:10:00Z" }),
      ],
      [item("E-01", "Entrance CCTV"), item("E-02", "Loading-bay CCTV")],
      START,
      END,
    );
    expect(lanes.map((l) => l.evidenceId)).toEqual(["E-01", "E-02"]);
    const shifted = lanes[1].marks[0];
    expect(shifted.at).toBeCloseTo(50);
    expect(shifted.sourceAt).toBeCloseTo(66.67, 1);
    expect(lanes[0].marks[0].sourceAt).toBeNull();
  });

  it("drops events outside the window and lanes with nothing in it", () => {
    const lanes = buildLanes(
      [event({ id: "EV-001", evidence_id: "E-05", normalized_time: "2026-10-10T20:00:00Z" })],
      [item("E-05", "Inventory")],
      START,
      END,
    );
    expect(lanes).toEqual([]);
  });

  it("turns uncertainty into a band width", () => {
    const [lane] = buildLanes(
      [event({ id: "EV-018", evidence_id: "E-06", normalized_time: "2026-10-10T20:18:00Z", uncertainty_seconds: 120 })],
      [item("E-06", "Witness")],
      START,
      END,
    );
    expect(lane.marks[0].spread).toBeCloseTo(16.67, 1);
  });
});

describe("shiftLabel", () => {
  it("shows how far normalization moved the event", () => {
    expect(shiftLabel(120)).toBe("−2:00");
    expect(shiftLabel(-90)).toBe("+1:30");
  });
});
