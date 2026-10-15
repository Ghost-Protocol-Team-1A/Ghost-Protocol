import { describe, expect, it } from "vitest";
import { filterCases, validateNewCase } from "./cases";
import type { CaseSummary } from "./types";

const valid = {
  title: "Loading dock review",
  description: "",
  scope: "Order of door events only",
  classification: "internal",
  start: "2026-10-12T08:00",
  end: "2026-10-12T09:00",
  offset: "+01:00",
};

describe("validateNewCase", () => {
  it("builds a payload with an explicit UTC offset", () => {
    expect(validateNewCase(valid).payload).toEqual({
      title: "Loading dock review",
      description: "",
      scope: "Order of door events only",
      classification: "internal",
      incident_start: "2026-10-12T08:00:00+01:00",
      incident_end: "2026-10-12T09:00:00+01:00",
    });
  });

  it("rejects a short title, a missing start and an unknown offset", () => {
    const { errors, payload } = validateNewCase({ ...valid, title: "ab", start: "", offset: "+09:30" });
    expect(payload).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(["offset", "start", "title"]);
  });

  it("rejects a window that ends before it starts", () => {
    const { errors } = validateNewCase({ ...valid, end: "2026-10-12T07:00" });
    expect(errors.end).toMatch(/after it starts/);
  });
});

describe("filterCases", () => {
  const cases = [
    { case: { id: "CASE-001", status: "active" }, open_conflicts: 3 },
    { case: { id: "CASE-002", status: "open" }, open_conflicts: 0 },
  ] as CaseSummary[];
  const ids = (list: CaseSummary[]) => list.map((c) => c.case.id);

  it("filters by status and by open conflicts", () => {
    expect(ids(filterCases(cases, "active"))).toEqual(["CASE-001"]);
    expect(ids(filterCases(cases, "open"))).toEqual(["CASE-002"]);
    expect(ids(filterCases(cases, "conflicts"))).toEqual(["CASE-001"]);
  });

  it("shows everything for all or an unknown filter", () => {
    expect(filterCases(cases, "all")).toHaveLength(2);
    expect(filterCases(cases, "archived")).toHaveLength(2);
  });
});

describe("classification", () => {
  it("rejects an unknown classification", () => {
    expect(validateNewCase({ ...valid, classification: "secret" }).errors.classification).toBeTruthy();
  });
});
