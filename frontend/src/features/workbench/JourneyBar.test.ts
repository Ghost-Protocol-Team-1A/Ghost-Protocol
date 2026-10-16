import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { flow, flowIndex } from "./JourneyBar";

describe("page flow", () => {
  it("places each case page in the order the work happens", () => {
    expect(flowIndex("/cases/CASE-002/evidence", "CASE-002")).toBe(3);
    expect(flowIndex("/cases/CASE-002/conflicts", "CASE-002")).toBe(5);
    expect(flowIndex("/cases/CASE-002", "CASE-002")).toBe(0);
    expect(flowIndex("/cases/CASE-002/graph", "CASE-002")).toBe(-1);
  });

  it("only links to pages that exist", () => {
    const app = path.resolve(__dirname, "../../app/(workstation)");
    for (const { href } of flow("CASE-001")) {
      const route = href.replace(/CASE-\d{3}/, "[caseId]");
      expect(existsSync(path.join(app, route, "page.tsx")), href).toBe(true);
    }
  });
});
