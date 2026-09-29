import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzerEmailConsent, foundingEmailConsent, foundingSmsConsent } from "../content/consent";
import { all, closeDb, get, resetDbForTests } from "../lib/db";
import { recordEvent } from "../lib/events";
import { parseFounding, recentFoundingFromIp, submitFounding, type FoundingInput } from "../lib/founding";
import { recentAnalysesFromIp } from "../lib/prospect/store";

let dir: string;
const saved = { notify: process.env.NOTIFY_EMAIL, key: process.env.AGENTMAIL_API_KEY };
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "founding-"));
  resetDbForTests(path.join(dir, "t.sqlite"));
  delete process.env.NOTIFY_EMAIL;
  delete process.env.AGENTMAIL_API_KEY;
});
afterEach(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
  if (saved.notify !== undefined) process.env.NOTIFY_EMAIL = saved.notify;
  if (saved.key !== undefined) process.env.AGENTMAIL_API_KEY = saved.key;
});

const meta = { ip: "203.0.113.7", userAgent: "vitest" };

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    businessName: "Heron Air",
    ownerName: "Sam Ortiz",
    email: "Sam@Example.com",
    mobile: "(772) 555-0142",
    smsConsent: false,
    trade: "hvac",
    today: "It goes to voicemail and I call back at night.",
    emailConsentVersion: foundingEmailConsent.version,
    smsConsentVersion: foundingSmsConsent.version,
    idempotencyKey: "k".repeat(24),
    ...overrides,
  };
}

function parsed(overrides: Record<string, unknown> = {}): FoundingInput {
  const result = parseFounding(body(overrides), meta);
  if ("error" in result) throw new Error(result.error);
  return result;
}

describe("founding form", () => {
  it("creates a founding prospect with the exact consent text, and does not claim a send", async () => {
    const result = await submitFounding(parsed());
    expect(result).toMatchObject({ ok: true, duplicate: false, notify: "simulated" });
    const row = get("SELECT source, status, business_name, owner_name, email, phone_e164, trade, lead_status, notify_status FROM prospects");
    expect(row).toEqual({
      source: "founding",
      status: "intake",
      business_name: "Heron Air",
      owner_name: "Sam Ortiz",
      email: "sam@example.com",
      phone_e164: "+17725550142",
      trade: "hvac",
      lead_status: "new",
      notify_status: "simulated",
    });
    const consents = all<{ channel: string; granted: number; text_shown: string; text_version: string; ip: string }>(
      "SELECT channel, granted, text_shown, text_version, ip FROM consents ORDER BY channel",
    );
    expect(consents).toEqual([
      { channel: "email", granted: 1, text_shown: foundingEmailConsent.text, text_version: foundingEmailConsent.version, ip: meta.ip },
      // The unchecked SMS box is recorded as a "no", with the text that was shown.
      { channel: "sms", granted: 0, text_shown: foundingSmsConsent.text, text_version: foundingSmsConsent.version, ip: meta.ip },
    ]);
  });

  it("records SMS consent only when the box was checked, and skips the SMS row without a number", async () => {
    await submitFounding(parsed({ smsConsent: true }));
    expect(get("SELECT granted FROM consents WHERE channel = 'sms'")).toEqual({ granted: 1 });
    await submitFounding(parsed({ mobile: "", idempotencyKey: "m".repeat(24) }));
    expect(all("SELECT id FROM consents WHERE channel = 'sms'")).toHaveLength(1);
  });

  it("returns the first request for a repeated idempotency key", async () => {
    const first = await submitFounding(parsed());
    const second = await submitFounding(parsed());
    expect(second).toMatchObject({ ok: true, duplicate: true });
    expect(first.ok && second.ok && first.id === second.id).toBe(true);
    expect(all("SELECT id FROM prospects")).toHaveLength(1);
    expect(all("SELECT id FROM consents")).toHaveLength(2);
  });

  it("rejects stale consent wording, SMS without a number, and bad input", () => {
    expect(parseFounding(body({ emailConsentVersion: "founding-email-old" }), meta)).toHaveProperty("error");
    expect(parseFounding(body({ smsConsentVersion: "founding-sms-old" }), meta)).toHaveProperty("error");
    expect(parseFounding(body({ mobile: "", smsConsent: true }), meta)).toHaveProperty("error");
    expect(parseFounding(body({ trade: "roofing" }), meta)).toHaveProperty("error");
    expect(parseFounding(body({ email: "nope" }), meta)).toHaveProperty("error");
    expect(parseFounding(body({ today: " " }), meta)).toHaveProperty("error");
    expect(parseFounding(body({ idempotencyKey: "short" }), meta)).toHaveProperty("error");
  });

  it("counts founding requests apart from analyzer demos for rate limits", async () => {
    await submitFounding(parsed());
    const since = new Date(Date.now() - 3600_000).toISOString();
    expect(recentFoundingFromIp(meta.ip, since)).toBe(1);
    expect(recentAnalysesFromIp(meta.ip, since)).toBe(0);
  });

  it("versions consent wording from the text itself", () => {
    expect(foundingEmailConsent.version).toMatch(/^founding-email-[0-9a-f]{8}$/);
    expect(new Set([foundingEmailConsent.version, foundingSmsConsent.version, analyzerEmailConsent.version]).size).toBe(3);
    for (const s of ["Message and data rates may apply", "STOP", "HELP"]) expect(foundingSmsConsent.text).toContain(s);
  });
});

describe("events", () => {
  it("stores flat, named events and refuses anything else", () => {
    expect(recordEvent({ name: "cta_click", anonymousId: "a1", props: { cta: "walkthrough", nested: { x: 1 } }, path: "/" })).toEqual({ ok: true });
    expect(get("SELECT name, props_json FROM events")).toEqual({ name: "cta_click", props_json: JSON.stringify({ cta: "walkthrough", path: "/" }) });
    expect(recordEvent({ name: "Bad Name", anonymousId: "a1" })).toHaveProperty("ok", false);
    expect(recordEvent({ name: "ok_name", anonymousId: "x".repeat(65) })).toHaveProperty("ok", false);
    expect(recordEvent({ name: "ok_name", anonymousId: "a", props: { big: "x".repeat(3000) } })).toHaveProperty("ok", false);
  });
});
