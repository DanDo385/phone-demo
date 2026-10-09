import { afterEach, describe, expect, it } from "vitest";
import { randomKey, randomUuid } from "../lib/clientId";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("client ids outside a secure context", () => {
  const original = crypto.randomUUID;

  afterEach(() => {
    Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
  });

  it("still builds a key and a uuid when randomUUID is missing", () => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    expect(typeof crypto.randomUUID).toBe("undefined");
    expect(randomKey()).toMatch(/^[0-9a-f]{32}$/);
    expect(randomUuid()).toMatch(UUID);
  });
});
