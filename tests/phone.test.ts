import { describe, expect, it } from "vitest";
import { sameNumber, toE164 } from "../lib/phone";

describe("phone numbers", () => {
  it("normalizes US numbers to E.164", () => {
    expect(toE164("7372583478")).toBe("+17372583478");
    expect(toE164("(737) 258-3478")).toBe("+17372583478");
    expect(toE164("1-737-258-3478")).toBe("+17372583478");
    expect(toE164("+1 737 258 3478")).toBe("+17372583478");
    expect(toE164("")).toBe("");
    expect(toE164(undefined)).toBe("");
  });

  it("matches the Twilio From value against a 10-digit configured number", () => {
    expect(sameNumber("+17372583478", "7372583478")).toBe(true);
    expect(sameNumber("+12018197595", "7372583478")).toBe(false);
    expect(sameNumber("", "")).toBe(false);
    expect(sameNumber("+17372583478", undefined)).toBe(false);
  });
});
