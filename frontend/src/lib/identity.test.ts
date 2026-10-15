import { describe, expect, it } from "vitest";
import { cleanName, greeting, initials, parseIdentity, serializeIdentity } from "./identity";

describe("demo identity", () => {
  it("accepts ordinary names and tidies whitespace", () => {
    expect(cleanName("  Judge   Adaeze ")).toBe("Judge Adaeze");
    expect(cleanName("Ọlá O'Neil-Smith")).toBe("Ọlá O'Neil-Smith");
  });

  it("rejects names that are empty, too long or carry markup", () => {
    expect(cleanName("")).toBeNull();
    expect(cleanName("A")).toBeNull();
    expect(cleanName("x".repeat(41))).toBeNull();
    expect(cleanName("<script>")).toBeNull();
    expect(cleanName("SYS; DROP")).toBeNull();
  });

  it("round-trips through the cookie and rejects tampered values", () => {
    const value = serializeIdentity({ name: "Judge Adaeze", role: "reviewer" });
    expect(parseIdentity(value)).toEqual({ name: "Judge Adaeze", role: "reviewer" });
    expect(parseIdentity('{"name":"Judge Adaeze","role":"admin"}')).toBeNull();
    expect(parseIdentity("not json")).toBeNull();
    expect(parseIdentity(undefined)).toBeNull();
  });

  it("makes initials and greetings", () => {
    expect(initials("Judge Adaeze")).toBe("JA");
    expect(initials("Femi")).toBe("F");
    expect(greeting(9)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(21)).toBe("Good evening");
  });
});
