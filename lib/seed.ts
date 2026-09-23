import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { get, run } from "./db";
import { id } from "./ids";
import { nowIso } from "./records";
import { windowForDow, zonedDateTime, zonedParts } from "./time";

function nextOpenDay(startOffset: number, hour: number): Date {
  const today = zonedParts(new Date());
  for (let add = startOffset; add < startOffset + 14; add++) {
    const base = new Date(Date.UTC(today.y, today.mo - 1, today.d));
    base.setUTCDate(base.getUTCDate() + add);
    const probe = zonedDateTime(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, 0);
    const parts = zonedParts(probe);
    const window = windowForDow(parts.isoDow);
    if (!window) continue;
    if (hour * 60 < window.start || hour * 60 >= window.end) continue;
    return probe;
  }
  return new Date();
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function ensureSeed(): void {
  const seeded = get("SELECT value FROM settings WHERE key = 'seeded'");
  if (!get("SELECT id FROM owner_users LIMIT 1")) {
    const password = process.env.DEMO_OWNER_PASSWORD || "palmetto-demo";
    run(
      "INSERT INTO owner_users(id, email, name, password_hash, created_at) VALUES(?, ?, ?, ?, ?)",
      "owner_alex",
      "alex.rivera@palmetto-coast.demo",
      "Alex Rivera",
      hashPassword(password),
      nowIso(),
    );
  }
  if (seeded) return;
  const people = [
    ["Carmen Ortiz", "+17725550111", "carmen.ortiz@example.com", "es", "HVAC maintenance", "HVAC_MAINT", "sam", 10, 60],
    ["Luis Navarro", "+17725550122", "luis.navarro@example.com", "es", "Panel inspection", "PANEL_INSPECT", "taylor", 9, 90],
    ["Priya Shah", "+17725550133", "priya.shah@example.com", "en", "Water heater is rumbling", "WATER_HEATER_DIAG", "morgan", 14, 90],
    ["Andre Williams", "+17725550144", "andre.williams@example.com", "en", "Slow hall bathroom drain", "DRAIN_ACCESS", "morgan", 15, 90],
    ["Elena Morales", "+17725550155", "elena.morales@example.com", "es", "Kitchen faucet drip — fictional sample", "FAUCET", "morgan", 11, 90],
    ["Noah Patel", "+17725550166", "noah.patel@example.com", "en", "Outlet in the garage is warm", "ELEC_DIAG", "taylor", 11, 90],
    ["Camille Bernard", "+17725550177", "camille.bernard@example.com", "en", "No cooling in the afternoon", "HVAC_DIAG", "sam", 13, 90],
    ["Jonah Brooks", "+17725550188", "jonah.brooks@example.com", "en", "Question about an EV charger", "EV_INSPECT", "taylor", 15, 90],
  ] as const;
  const addresses = [
    "120 SW Bayshore Blvd, Port St. Lucie, Florida",
    "400 SW St Lucie West Blvd, St. Lucie West, Florida",
    "88 SW Village Parkway, Tradition, Florida",
    "1500 SE Lennard Road, Port St. Lucie, Florida",
    "220 SW Darlington Ave, Port St. Lucie, Florida",
    "700 SW Import Drive, Port St. Lucie, Florida",
    "15 SW Innovation Way, Tradition, Florida",
    "940 SW South Macedo Blvd, Port St. Lucie, Florida",
  ];
  people.forEach((person, index) => {
    const customerId = id("cus");
    const inquiryId = id("inq");
    const stamp = nowIso();
    const when = nextOpenDay(1 + (index % 3), person[7]);
    const end = new Date(when.getTime() + person[8] * 60 * 1000);
    run("INSERT INTO customers(id, name, phone, email, preferred_language, created_at) VALUES(?, ?, ?, ?, ?, ?)", customerId, person[0], person[1], person[2], person[3], stamp);
    run(
      `INSERT INTO inquiries(id, customer_id, status, preferred_language, language_lock, language_asked, issue, service_code, service_address, in_service_area, facts_json, origin, created_at, updated_at)
       VALUES(?, ?, 'open', ?, 'explicit', 1, ?, ?, ?, 1, ?, 'seed', ?, ?)`,
      inquiryId,
      customerId,
      person[3],
      person[4],
      person[5],
      addresses[index],
      JSON.stringify({ name: person[0], phone: person[1], email: person[2], address: addresses[index], issue: person[4], serviceCode: person[5] }),
      stamp,
      stamp,
    );
    if (index < 3) {
      run(
        `INSERT INTO appointments(id, inquiry_id, technician_id, starts_at, ends_at, status, summary, address, language, issue, customer_name, customer_phone, customer_email, source_kind, created_at)
         VALUES(?, ?, ?, ?, ?, 'booked', ?, ?, ?, ?, ?, ?, ?, 'simulated', ?)`,
        id("appt"),
        inquiryId,
        person[6],
        when.toISOString(),
        end.toISOString(),
        person[4],
        addresses[index],
        person[3],
        person[4],
        person[0],
        person[1],
        person[2],
        stamp,
      );
    }
    if (person[0] === "Elena Morales") {
      const source = path.join(process.cwd(), "assets", "sample-undersink.jpg");
      if (fs.existsSync(source)) {
        const dir = path.join(process.cwd(), "data", "attachments", inquiryId);
        fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, "sample-undersink.jpg");
        fs.copyFileSync(source, target);
        run(
          `INSERT INTO attachments(id, inquiry_id, filename, content_type, size_bytes, storage_path, caption, created_at, source_kind)
           VALUES(?, ?, 'sample-undersink.jpg', 'image/jpeg', ?, ?, ?, ?, 'simulated')`,
          id("att"),
          inquiryId,
          fs.statSync(target).size,
          target,
          "FICTIONAL DEMO PHOTO — not a customer home and not a diagnosis.",
          stamp,
        );
      }
    }
  });
  const blocked = nextOpenDay(1, 10);
  const blockedEnd = new Date(blocked.getTime() + 90 * 60 * 1000);
  const blockerId = id("inq");
  const blockerCustomer = id("cus");
  run(
    "INSERT INTO customers(id, name, phone, email, preferred_language, created_at) VALUES(?, 'Sample Conflict', '+17725550100', 'conflict@example.com', 'en', ?)",
    blockerCustomer,
    nowIso(),
  );
  run(
    `INSERT INTO inquiries(id, customer_id, status, preferred_language, language_lock, facts_json, issue, service_code, service_address, in_service_area, origin, created_at, updated_at)
     VALUES(?, ?, 'open', 'en', 'explicit', '{}', 'Existing plumbing visit', 'DIAG', '1 Demo Lane, Port St. Lucie, Florida', 1, 'seed', ?, ?)`,
    blockerId,
    blockerCustomer,
    nowIso(),
    nowIso(),
  );
  run(
    `INSERT INTO appointments(id, inquiry_id, technician_id, starts_at, ends_at, status, summary, address, language, source_kind, created_at)
     VALUES(?, ?, 'morgan', ?, ?, 'booked', 'Existing plumbing visit', '1 Demo Lane, Port St. Lucie, Florida', 'en', 'simulated', ?)`,
    id("appt"),
    blockerId,
    blocked.toISOString(),
    blockedEnd.toISOString(),
    nowIso(),
  );
  run("INSERT INTO settings(key, value) VALUES('seeded', '1')");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(next));
}
