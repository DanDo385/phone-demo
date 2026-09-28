import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { all, closeDb, get, resetDbForTests, run } from "../lib/db";
import { brand, foundingOffer, formatPrice, ownershipPromise, plan } from "../lib/brand";
import { Qualification, qualificationTotal } from "../lib/qualification";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-"));
});
afterEach(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = "2026-09-28T12:00:00.000Z";

function prospect(id: string): void {
  run(
    "INSERT INTO prospects(id, status, website, email, created_at, updated_at) VALUES (?, 'pending', 'example.com', 'owner@example.com', ?, ?)",
    id,
    NOW,
    NOW,
  );
}

describe("launch schema", () => {
  it("adds the sales columns to a database created before them", () => {
    const file = path.join(dir, "legacy.sqlite");
    const legacy = new DatabaseSync(file);
    legacy.exec(`CREATE TABLE prospects (id TEXT PRIMARY KEY, status TEXT NOT NULL, stage TEXT, website TEXT NOT NULL,
      gbp_input TEXT, email TEXT NOT NULL, phone_e164 TEXT, client_ip TEXT, sources_json TEXT, analysis_json TEXT,
      error TEXT, report_email_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
    legacy.exec("INSERT INTO prospects(id, status, website, email, created_at, updated_at) VALUES ('p_old', 'ready', 'a.com', 'a@a.com', 'x', 'x')");
    legacy.close();

    resetDbForTests(file);
    const cols = all<{ name: string }>("PRAGMA table_info(prospects)").map((c) => c.name);
    for (const col of ["owner_name", "role", "trade", "utm_json", "lead_status", "qualification_json", "place_id", "place_confirmed"]) {
      expect(cols).toContain(col);
    }
    expect(get("SELECT status, lead_status, place_confirmed FROM prospects WHERE id = 'p_old'")).toEqual({
      status: "ready",
      lead_status: "new",
      place_confirmed: 0,
    });
    expect(() => run("UPDATE prospects SET lead_status = 'maybe' WHERE id = 'p_old'")).toThrow();
  });

  it("keeps consents append-only", () => {
    resetDbForTests(path.join(dir, "fresh.sqlite"));
    prospect("p1");
    run(
      "INSERT INTO consents(id, prospect_id, channel, granted, text_shown, text_version, ip, user_agent, created_at) VALUES ('c1', 'p1', 'sms', 1, 'Text me', 'sms-v1', '203.0.113.9', 'test', ?)",
      NOW,
    );
    expect(() => run("UPDATE consents SET granted = 0 WHERE id = 'c1'")).toThrow(/append-only/);
    expect(() => run("DELETE FROM consents WHERE id = 'c1'")).toThrow(/append-only/);
    expect(() =>
      run("INSERT INTO consents(id, prospect_id, channel, granted, text_shown, text_version, created_at) VALUES ('c2', 'p1', 'fax', 1, 't', 'v', ?)", NOW),
    ).toThrow();
  });

  it("books a walkthrough once per idempotency key", () => {
    resetDbForTests(path.join(dir, "fresh.sqlite"));
    prospect("p1");
    const insert = () =>
      run("INSERT INTO bookings_walkthrough(id, prospect_id, starts_at, idempotency_key, created_at) VALUES (?, 'p1', ?, 'k1', ?)", `b${Math.random()}`, NOW, NOW);
    insert();
    expect(insert).toThrow();
    expect(all("SELECT id FROM bookings_walkthrough")).toHaveLength(1);
  });

  it("creates the events and previews tables", () => {
    resetDbForTests(path.join(dir, "fresh.sqlite"));
    run("INSERT INTO events(id, anonymous_id, name, created_at) VALUES ('e1', 'anon', 'page_view', ?)", NOW);
    run("INSERT INTO previews(id, prospect_id, template_key, created_at, updated_at) VALUES ('v1', 'p1', 'trade-a', ?, ?)", NOW, NOW);
    expect(get("SELECT props_json, prospect_id FROM events")).toEqual({ props_json: "{}", prospect_id: null });
    expect(get("SELECT image_selection_json FROM previews")).toEqual({ image_selection_json: "[]" });
  });
});

describe("qualification", () => {
  it("scores five criteria from 0 to 2", () => {
    const q = Qualification.parse({ urgent_high_value_jobs: 2, owner_answers_phone: 1, weak_web_profile: 2, calendar_discipline: 0, can_absorb_overflow: 1 });
    expect(qualificationTotal(q)).toBe(6);
    expect(() => Qualification.parse({ ...q, owner_answers_phone: 3 })).toThrow();
    expect(() => Qualification.parse({ ...q, extra: 1 })).toThrow();
  });
});

describe("brand", () => {
  it("holds the launch offer", () => {
    expect(formatPrice(plan("scribe"))).toBe("$297/month");
    expect(formatPrice(plan("scribeSquire"))).toBe("$497/month");
    expect(formatPrice(plan("custom"))).toBe("Quoted");
    expect(foundingOffer.terms[0]).toBe("Open to the first five qualified businesses");
    expect(foundingOffer.slotsRemaining).toBeLessThanOrEqual(foundingOffer.totalSlots);
    expect(ownershipPromise).toBe(
      `You own the number, domain, data, listing, calendar, and merchant account. ${brand.company.shortName} operates them with revocable access.`,
    );
  });
});
