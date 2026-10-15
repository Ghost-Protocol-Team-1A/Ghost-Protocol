import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ACCEPTED_EXTENSIONS, checkUpload } from "./intake";

describe("checkUpload", () => {
  it("accepts an allowed, non-empty file", () => {
    expect(checkUpload({ name: "gate_cam.MP4", size: 2048 })).toBeNull();
  });

  it("accepts the formats phones and messaging apps produce", () => {
    for (const name of ["Voice Memo.m4a", "PTT-2026.opus", "IMG_0042.HEIC", "IMG_0043.MOV", "clip.webm", "statement.docx"]) {
      expect(checkUpload({ name, size: 1024 }), name).toBeNull();
    }
  });

  it("rejects missing, empty, oversized and disallowed files", () => {
    expect(checkUpload(null)).toMatch(/Choose a file/);
    expect(checkUpload({ name: "log.csv", size: 0 })).toMatch(/empty/);
    expect(checkUpload({ name: "big.mp4", size: 51 * 1024 * 1024 })).toMatch(/50 MB/);
    expect(checkUpload({ name: "tool.exe", size: 10 })).toMatch(/not accepted/);
  });
});

describe("accepted formats", () => {
  it("match the API's allow-list exactly", () => {
    const py = readFileSync(path.resolve(__dirname, "../../../backend/app/storage/validation.py"), "utf8");
    const block = py.slice(py.indexOf("ALLOWED_EXTENSIONS"), py.indexOf("MEDIA_TYPES"));
    const backend = [...block.matchAll(/"([a-z0-9]+)": EvidenceType/g)].map((m) => m[1]);
    expect([...ACCEPTED_EXTENSIONS].sort()).toEqual(backend.sort());
  });
});
