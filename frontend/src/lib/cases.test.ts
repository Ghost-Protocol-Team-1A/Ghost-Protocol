import { describe, expect, it } from "vitest";
import { validateNewCase } from "./cases";

const valid = {
  title: "Loading dock review",
  description: "",
  start: "2026-10-12T08:00",
  end: "2026-10-12T09:00",
  offset: "+01:00",
};

describe("validateNewCase", () => {
  it("builds a payload with an explicit UTC offset", () => {
    expect(validateNewCase(valid).payload).toEqual({
      title: "Loading dock review",
      description: "",
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
