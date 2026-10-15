import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { TOUR, tourHref, tourIndex } from "./tour";

describe("guided tour", () => {
  it("reads the step from the URL and ignores anything out of range", () => {
    expect(tourIndex("1")).toBe(0);
    expect(tourIndex(String(TOUR.length))).toBe(TOUR.length - 1);
    expect(tourIndex("0")).toBeNull();
    expect(tourIndex(String(TOUR.length + 1))).toBeNull();
    expect(tourIndex("abc")).toBeNull();
    expect(tourIndex(null)).toBeNull();
  });

  it("builds links that keep the page's own query", () => {
    expect(tourHref(0)).toBe("/dashboard?tour=1");
    expect(tourHref(2)).toBe("/cases/CASE-001/conflicts?c=C-02&tour=3");
  });

  it("only visits pages that exist", () => {
    const app = path.resolve(__dirname, "../app/(workstation)");
    for (const step of TOUR) {
      const route = step.path.replace(/CASE-\d{3}/, "[caseId]");
      expect(existsSync(path.join(app, route, "page.tsx")), step.path).toBe(true);
    }
  });
});
