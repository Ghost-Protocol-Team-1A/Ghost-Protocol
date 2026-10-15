import { describe, expect, it } from "vitest";
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
    expect(NAV.map((n) => n.label)).not.toContain("Graph");
  });
});
