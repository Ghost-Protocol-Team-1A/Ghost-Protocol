import { describe, expect, it } from "vitest";
import { checkUpload } from "./intake";

describe("checkUpload", () => {
  it("accepts an allowed, non-empty file", () => {
    expect(checkUpload({ name: "gate_cam.MP4", size: 2048 })).toBeNull();
  });

  it("rejects missing, empty, oversized and disallowed files", () => {
    expect(checkUpload(null)).toMatch(/Choose a file/);
    expect(checkUpload({ name: "log.csv", size: 0 })).toMatch(/empty/);
    expect(checkUpload({ name: "big.mp4", size: 51 * 1024 * 1024 })).toMatch(/50 MB/);
    expect(checkUpload({ name: "tool.exe", size: 10 })).toMatch(/not accepted/);
  });
});
