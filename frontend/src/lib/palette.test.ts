import { describe, expect, it } from "vitest";
import { type PaletteItem, rankItems } from "./palette";

const item = (id: string, group: PaletteItem["group"], label: string, hint = ""): PaletteItem => ({
  id,
  group,
  label,
  hint,
  href: `/${id}`,
});

const items: PaletteItem[] = [
  item("page:/dashboard", "Go to", "Dashboard", "Page"),
  item("page:/timeline", "Go to", "Timeline", "Page"),
  item("action:tour", "Actions", "Start guided demo", "7 stops"),
  item("C-01", "Conflicts", "C-01 · RULE-DUP-001", "open"),
  item("C-02", "Conflicts", "C-02 · RULE-TIME-002", "open"),
  item("EV-009", "Events", "EV-009 · LOADING-BAY door opens (badge B-117)", "E-05"),
  item("EV-012", "Events", "EV-012 · LOADING-BAY door opens (badge B-117)", "E-04"),
  item("E-02", "Evidence", "E-02 · Loading-bay CCTV", "bay_cam_2116.mp4"),
];

describe("rankItems", () => {
  it("shows pages and actions before anything is typed", () => {
    expect(rankItems(items, "").map((i) => i.id)).toEqual(["page:/dashboard", "page:/timeline", "action:tour"]);
  });

  it("puts an exact ID first", () => {
    expect(rankItems(items, "c-02")[0].id).toBe("C-02");
    expect(rankItems(items, "EV-012")[0].id).toBe("EV-012");
  });

  it("needs every word to match, in label, hint or group", () => {
    expect(rankItems(items, "door e-05").map((i) => i.id)).toEqual(["EV-009"]);
    expect(rankItems(items, "time rule").map((i) => i.id)).toEqual(["C-02"]);
    expect(rankItems(items, "nothing here")).toEqual([]);
  });

  it("ranks label prefixes and word starts above loose matches", () => {
    expect(rankItems(items, "tim").map((i) => i.id)).toEqual(["page:/timeline", "C-02"]);
  });
});
