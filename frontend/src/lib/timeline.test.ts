import { describe, expect, it } from "vitest";
import { conflictsFor, filterEvents, timelineHref } from "./timeline";
import type { Conflict, TimelineEvent } from "./types";

const ev = (id: string, evidence_id: string, state: TimelineEvent["state"]) =>
  ({ id, evidence_id, state }) as TimelineEvent;
const events = [ev("EV-009", "E-05", "contradicted"), ev("EV-012", "E-04", "supported"), ev("EV-014", "E-02", "supported")];

describe("timeline helpers", () => {
  it("filters by source and claim state together", () => {
    expect(filterEvents(events, { state: "supported" }).map((e) => e.id)).toEqual(["EV-012", "EV-014"]);
    expect(filterEvents(events, { source: "E-02", state: "supported" }).map((e) => e.id)).toEqual(["EV-014"]);
  });

  it("ignores unknown filter values instead of hiding everything", () => {
    expect(filterEvents(events, { source: "E-99", state: "guilty" })).toHaveLength(3);
  });

  it("finds conflicts by event or by evidence item", () => {
    const conflicts = [
      { id: "C-01", event_ids: ["EV-012", "EV-009"], evidence_ids: ["E-04", "E-05"] },
      { id: "C-02", event_ids: ["EV-014"], evidence_ids: ["E-02"] },
    ] as Conflict[];
    expect(conflictsFor(events[0], conflicts).map((c) => c.id)).toEqual(["C-01"]);
    expect(conflictsFor(events[2], conflicts).map((c) => c.id)).toEqual(["C-02"]);
  });

  it("keeps filters when selecting an event", () => {
    expect(timelineHref("CASE-001", { state: "supported" }, { ev: "EV-014" })).toBe(
      "/cases/CASE-001/timeline?state=supported&ev=EV-014",
    );
    expect(timelineHref("CASE-001", { state: "supported" }, { state: undefined })).toBe(
      "/cases/CASE-001/timeline",
    );
  });
});
