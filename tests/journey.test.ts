import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, get, resetDbForTests, run } from "../lib/db";
import { calculateEstimate } from "../lib/estimate";
import { translationKeepsFacts } from "../lib/language";
import { readLanguage, resolveLanguage } from "../lib/language";
import { cancelReminder, advanceClockToReminder, tickReminders } from "../lib/reminders";
import { runScenario } from "../lib/replay";
import { ensureSeed } from "../lib/seed";
import { findConflict, listSlots } from "../lib/scheduling";
import { lookupToken, issueToken } from "../lib/records";
import { deriveStages } from "../lib/stages";
import { verifyElevenLabsSignature, verifySvixSignature, verifyTwilioSignature, twilioSignature } from "../lib/webhooks";
import { executeTool } from "../lib/tools";
import { formatMoney } from "../lib/money";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "palmetto-"));
  process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
  process.env.SCHEDULER_DISABLED = "1";
  delete process.env.AGENTMAIL_API_KEY;
  delete process.env.GOOGLE_CLIENT_ID;
  resetDbForTests(process.env.DATABASE_PATH);
  ensureSeed();
});

afterEach(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("price book", () => {
  it("credits the diagnostic fee on the valve example", () => {
    const estimate = calculateEstimate("VALVE_SHUTOFF");
    expect("error" in estimate).toBe(false);
    if ("error" in estimate) return;
    expect(estimate.totalCents).toBe(22500);
    expect(estimate.lines.map((line) => line.amountCents)).toEqual([8900, 22500, -8900]);
    expect(estimate.speech.en).toContain(formatMoney(8900));
    expect(estimate.speech.es).toContain("$225.00");
    expect(estimate.speech.es).toContain("$89.00");
    expect(translationKeepsFacts(estimate.speech.en, estimate.speech.es, ["$89.00", "$225.00"])).toBe(true);
  });

  it("does not invent a panel price", () => {
    const estimate = calculateEstimate("PANEL_INSPECT");
    expect("error" in estimate).toBe(false);
    if ("error" in estimate) return;
    expect(estimate.totalCents).toBeNull();
    expect(estimate.firm).toBe(false);
  });
});

describe("language", () => {
  it("switches on an explicit request and ignores a name", () => {
    const spanish = resolveLanguage({ text: "Español, por favor", current: "en", mode: "auto", lock: null, languageAsked: false });
    expect(spanish.language).toBe("es");
    const name = resolveLanguage({ text: "My name is Sofia", current: "en", mode: "auto", lock: "detected", languageAsked: false });
    expect(name.language).toBe("en");
    expect(name.event).toBeUndefined();
    const back = resolveLanguage({ text: "Can we continue in English?", current: "es", mode: "auto", lock: "explicit", languageAsked: true });
    expect(back.language).toBe("en");
    expect(readLanguage("")).toEqual({ uncertain: false });
  });

  it("asks when a single Spanish word is uncertain and refuses an unsupported language", () => {
    const uncertain = resolveLanguage({ text: "gracias", current: "en", mode: "auto", lock: null, languageAsked: false });
    expect(uncertain.ask).toBe(true);
    expect(uncertain.language).toBe("en");
    const french = resolveLanguage({ text: "Pouvez-vous parler français?", current: "en", mode: "auto", lock: null, languageAsked: false });
    expect(french.unsupported).toBe("fr");
    expect(french.language).toBe("en");
  });
});

describe("journey", () => {
  it("runs English, Spanish, and a mid-call switch without duplicate bookings", async () => {
    for (const scenario of ["en", "es", "switch"] as const) {
      const inquiryId = await runScenario(scenario);
      const appointments = get<{ n: number }>("SELECT COUNT(*) AS n FROM appointments WHERE inquiry_id = ? AND status = 'booked'", inquiryId);
      const continuations = get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM emails WHERE inquiry_id = ? AND kind = 'continuation'",
        inquiryId,
      );
      expect(appointments?.n).toBe(1);
      expect(continuations?.n).toBe(1);
      const email = get<{ status: string }>("SELECT status FROM emails WHERE inquiry_id = ? AND kind = 'continuation'", inquiryId);
      expect(email?.status).toBe("simulated");
      const facts = JSON.parse(String(get<{ facts_json: string }>("SELECT facts_json FROM inquiries WHERE id = ?", inquiryId)?.facts_json));
      expect(facts.appointmentId).toBeTruthy();
      expect(facts.email).toContain("@");
      expect(String(facts.address)).toMatch(/Port St\. Lucie|Tradition/);
    }
  });

  it("keeps one inquiry when the caller switches language", async () => {
    const inquiryId = await runScenario("switch");
    const events = get<{ n: number }>("SELECT COUNT(*) AS n FROM language_events WHERE inquiry_id = ?", inquiryId);
    expect(events?.n).toBeGreaterThanOrEqual(2);
    const inquiries = get<{ n: number }>("SELECT COUNT(*) AS n FROM inquiries WHERE id = ?", inquiryId);
    expect(inquiries?.n).toBe(1);
    const turns = get<{ text: string }>(
      "SELECT text FROM transcript_turns WHERE inquiry_id = ? AND speaker = 'caller' AND text LIKE '%Español%'",
      inquiryId,
    );
    expect(turns?.text).toContain("Español");
  });

  it("does not confirm a conflicting slot", async () => {
    const inquiryId = await runScenario("en");
    const conflict = get<{ starts_at: string; technician_id: string }>(
      "SELECT starts_at, technician_id FROM appointments WHERE summary = 'Existing plumbing visit'",
    );
    expect(conflict).toBeTruthy();
    const result = await executeTool({
      inquiryId,
      sourceKind: "simulated",
      delivery: "simulated",
      call: {
        name: "book_appointment",
        args: { starts_at: conflict!.starts_at, service_code: "VALVE_SHUTOFF" },
        idempotencyKey: `book:${inquiryId}:conflict`,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("conflict");
    const again = await executeTool({
      inquiryId,
      sourceKind: "simulated",
      delivery: "simulated",
      call: {
        name: "book_appointment",
        args: { starts_at: conflict!.starts_at, service_code: "VALVE_SHUTOFF" },
        idempotencyKey: `book:${inquiryId}:conflict`,
      },
    });
    expect(again.duplicate).toBe(true);
    const booked = get<{ n: number }>("SELECT COUNT(*) AS n FROM appointments WHERE inquiry_id = ? AND status = 'booked'", inquiryId);
    expect(booked?.n).toBe(1);
  });
});

describe("access and reminders", () => {
  it("expires links and stops another inquiry from using them", () => {
    const inquiryId = get<{ id: string }>("SELECT id FROM inquiries LIMIT 1")!.id;
    const raw = issueToken(inquiryId, "continuation", 7);
    expect(lookupToken(raw, "continuation")?.inquiry_id).toBe(inquiryId);
    const other = get<{ id: string }>("SELECT id FROM inquiries WHERE id != ? LIMIT 1", inquiryId)!.id;
    expect(lookupToken(raw, "continuation")?.inquiry_id).not.toBe(other);
    expect(lookupToken(raw, "review")).toBeUndefined();
    run(
      "UPDATE access_tokens SET expires_at = ? WHERE token_hash = ?",
      new Date(Date.now() - 1000).toISOString(),
      require("node:crypto").createHash("sha256").update(raw).digest("hex"),
    );
    expect(lookupToken(raw)).toBeUndefined();
  });

  it("cancels the reminder on opt-out and sends one when the demo clock advances", async () => {
    const inquiryId = await runScenario("en");
    const { completeDemoService } = await import("../lib/invoice");
    const done = await completeDemoService({ inquiryId, ownerName: "Alex Rivera", delivery: "simulated", sourceKind: "simulated" });
    expect(done.ok).toBe(true);
    const before = get<{ n: number }>("SELECT COUNT(*) AS n FROM emails WHERE inquiry_id = ? AND kind = 'reminder'", inquiryId);
    expect(before?.n).toBe(0);
    cancelReminder(inquiryId, "opt_out");
    advanceClockToReminder(inquiryId);
    await tickReminders();
    const afterOpt = get<{ n: number }>("SELECT COUNT(*) AS n FROM emails WHERE inquiry_id = ? AND kind = 'reminder'", inquiryId);
    expect(afterOpt?.n).toBe(0);
    const second = await runScenario("es");
    await completeDemoService({ inquiryId: second, ownerName: "Alex Rivera", delivery: "simulated", sourceKind: "simulated" });
    advanceClockToReminder(second);
    await tickReminders();
    await tickReminders();
    const reminders = get<{ n: number }>("SELECT COUNT(*) AS n FROM emails WHERE inquiry_id = ? AND kind = 'reminder'", second);
    expect(reminders?.n).toBe(1);
    const status = get<{ status: string }>("SELECT status FROM emails WHERE inquiry_id = ? AND kind = 'reminder'", second);
    expect(status?.status).toBe("simulated");
    const original = get<{ text: string }>(
      "SELECT text FROM transcript_turns WHERE inquiry_id = ? AND text LIKE '%fregadero%'",
      second,
    );
    expect(original?.text).toContain("fregadero");
    const translated = get<{ text: string }>(
      "SELECT tr.text AS text FROM translations tr JOIN transcript_turns t ON t.id = tr.turn_id WHERE t.inquiry_id = ? AND t.text LIKE '%fregadero%'",
      second,
    );
    expect(translated?.text).toContain("sink");
    expect(translated?.text).not.toContain("€");
  });
});

describe("signatures and stages", () => {
  it("verifies provider signatures and rejects stale ones", () => {
    const url = "https://example.com/api/webhooks/twilio/voice";
    const params = { CallSid: "CA1", From: "+1555" };
    const sig = twilioSignature("token", url, params);
    expect(verifyTwilioSignature({ authToken: "token", url, params, signature: sig })).toBe(true);
    expect(verifyTwilioSignature({ authToken: "token", url, params, signature: "nope" })).toBe(false);
    const body = "{\"ok\":true}";
    const ts = "1700000000";
    const crypto = require("crypto") as typeof import("crypto");
    const hash = crypto.createHmac("sha256", "secret").update(`${ts}.${body}`).digest("hex");
    expect(verifyElevenLabsSignature({ secret: "secret", rawBody: body, header: `t=${ts},v0=${hash}`, nowMs: 1700000000 * 1000 })).toBe(true);
    expect(verifySvixSignature({
      secret: "whsec_plJ3nmyCDGBKInavdOK15jsl",
      rawBody: '{"event_type":"ping","data":{"success":true}}',
      id: "msg_loFOjxBNrRLzqYUf",
      timestamp: "1731705121",
      signature: "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=",
      nowMs: 1731705121 * 1000,
    })).toBe(true);
  });

  it("distinguishes failed email from delivery in the stage model", () => {
    const failed = deriveStages({
      hasSession: true,
      sessionActive: false,
      callFailed: false,
      continuationStatus: "failed",
      linkOpened: false,
      scheduling: false,
      appointment: false,
      bookingFailed: false,
      reminderStatus: null,
    });
    expect(failed[1].status).toBe("failed");
    const open = deriveStages({
      hasSession: true,
      sessionActive: false,
      callFailed: false,
      continuationStatus: "simulated",
      linkOpened: true,
      scheduling: true,
      appointment: true,
      bookingFailed: false,
      invoiceStatus: "emailed",
      reviewStatus: "simulated",
      reminderStatus: "pending",
    });
    expect(open.map((stage) => stage.status)).toEqual(["completed", "completed", "completed", "completed", "completed", "waiting"]);
  });

  it("skips a busy technician slot", () => {
    const start = new Date("2026-09-23T14:00:00.000Z");
    const slots = listSlots({
      now: new Date("2026-09-22T12:00:00.000Z"),
      serviceCode: "VALVE_SHUTOFF",
      busy: [{ technicianId: "morgan", start: "2026-09-23T14:00:00.000Z", end: "2026-09-23T15:30:00.000Z" }],
      limit: 8,
    });
    expect(slots.some((slot) => slot.start === start.toISOString())).toBe(false);
    expect(findConflict({
      technicianId: "morgan",
      start,
      end: new Date("2026-09-23T15:30:00.000Z"),
      busy: [{ technicianId: "morgan", start: "2026-09-23T14:00:00.000Z", end: "2026-09-23T15:30:00.000Z" }],
    })).toBeTruthy();
  });
});
