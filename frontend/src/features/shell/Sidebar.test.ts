import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { isActive, NAV } from "./Sidebar";

describe("sidebar", () => {
  it("marks the current page, including pages under it", () => {
    expect(isActive("/cases/CASE-001/timeline", "/cases/CASE-001/timeline")).toBe(true);
    expect(isActive("/cases/CASE-001/report/download", "/cases/CASE-001/report")).toBe(true);
    expect(isActive("/cases/CASE-001/timeline", "/cases/CASE-001/report")).toBe(false);
  });

  it("highlights Cases on the register and the create page only", () => {
    expect(isActive("/cases", "/cases")).toBe(true);
    expect(isActive("/cases/new", "/cases")).toBe(true);
    expect(isActive("/cases/CASE-001/timeline", "/cases")).toBe(false);
  });

  it("only links to pages that exist", () => {
    const app = path.resolve(__dirname, "../../app/(workstation)");
    for (const { href } of NAV) {
      const route = href.replace(/CASE-\d{3}/, "[caseId]");
      expect(existsSync(path.join(app, route, "page.tsx")), href).toBe(true);
    }
  });
});
