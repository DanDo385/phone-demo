import { all, get, run, transaction } from "./db";
import { evaluateJev } from "./scoring";

export const DEFAULT_OUTREACH_QUERY = "independent home-service shops that miss calls and would use an AI receptionist";
const CHOICE_LIMIT = 200;

const STEMS = ["Harbor", "Palmetto", "Tide", "Oak", "Citrus", "Sawgrass", "Marina", "Cypress", "Heron", "Lagoon", "Indian", "Seagrape", "Tradition", "Jensen", "Stuart", "Savannas"];
const PLACES = ["Pine", "Marsh", "Trace", "Cove", "Ridge", "Bend", "Landing", "Hammock", "Crossing", "Point"];
const TRADES = [
  { code: "plumbing", noun: "Plumbing" },
  { code: "hvac", noun: "Air" },
  { code: "electrical", noun: "Electric" },
  { code: "roofing", noun: "Roofing" },
  { code: "pest", noun: "Pest" },
  { code: "landscaping", noun: "Lawn" },
] as const;
const CITIES = ["Port St. Lucie", "Tradition", "St. Lucie West", "Fort Pierce", "Stuart"];

export type Prospect = {
  id: string;
  name: string;
  trade: string;
  city: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string;
  answers_own_phone: number;
  chain: number;
  spanish: number;
};

export type RankedProspect = Prospect & { signal: number; rank: number };

export type ProspectRank = {
  query: string;
  mode: "jev" | "rules";
  model: string | null;
  matches: number | null;
  matchLabel: string | null;
  considered: number;
  excludedWithWebsite: number;
  narrowed: boolean;
  rows: RankedProspect[];
};

export function catalogRecords(): Prospect[] {
  const rows: Prospect[] = [];
  for (let i = 0; i < STEMS.length * PLACES.length; i++) {
    const trade = TRADES[i % TRADES.length];
    const chain = i % 17 === 0;
    const spanish = i % 4 === 0;
    const hasWebsite = i % 5 === 0;
    const answers = i % 3 !== 0;
    const stem = STEMS[i % STEMS.length];
    const place = PLACES[Math.floor(i / STEMS.length) % PLACES.length];
    const name = chain ? `${stem} ${trade.noun} National` : `${stem} ${place} ${trade.noun}`;
    const notes = chain
      ? "Franchise counter. New jobs are dispatched by a national line."
      : spanish
        ? "Spanish-speaking owner. The shop phone is the owner's cell, and daytime calls are often missed."
        : answers
          ? "Two-person shop. The owner answers the shop phone during the day and misses the evening ones."
          : "No office staff. Missed calls go to a personal voicemail.";
    rows.push({
      id: `p${String(i + 1).padStart(3, "0")}`,
      name,
      trade: trade.code,
      city: CITIES[i % CITIES.length],
      phone: i % 11 === 0 ? null : `772-555-${String(2000 + i).padStart(4, "0")}`,
      email: i % 7 === 0 ? null : `${trade.code}.${i + 1}@example.com`,
      website: hasWebsite ? `https://${stem.toLowerCase()}-${trade.code}.example` : null,
      notes,
      answers_own_phone: answers ? 1 : 0,
      chain: chain ? 1 : 0,
      spanish: spanish ? 1 : 0,
    });
  }
  return rows;
}

export function ensureProspects(): void {
  const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects");
  if ((count?.n ?? 0) > 0) return;
  const rows = catalogRecords();
  transaction(() => {
    for (const row of rows) {
      run(
        `INSERT INTO prospects(id, name, trade, city, phone, email, website, notes, answers_own_phone, chain, spanish)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.name,
        row.trade,
        row.city,
        row.phone,
        row.email,
        row.website,
        row.notes,
        row.answers_own_phone,
        row.chain,
        row.spanish,
      );
    }
  });
}

export function prospectCounts(): { total: number; withoutWebsite: number } {
  ensureProspects();
  const total = Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects")?.n ?? 0);
  const withoutWebsite = Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects WHERE website IS NULL OR website = ''")?.n ?? 0);
  return { total, withoutWebsite };
}

function withoutWebsite(): Prospect[] {
  ensureProspects();
  return all<Prospect>(
    `SELECT id, name, trade, city, phone, email, website, notes, answers_own_phone, chain, spanish
     FROM prospects WHERE website IS NULL OR website = '' ORDER BY id`,
  );
}

function rulesScore(row: Prospect, query: string): number {
  const hay = `${row.name} ${row.trade} ${row.city} ${row.notes}`.toLowerCase();
  const tokens = query.toLowerCase().split(/[^a-z0-9áéíóúñ]+/i).filter((token) => token.length > 3);
  let score = 0;
  for (const token of tokens) if (hay.includes(token)) score += 3;
  if (row.answers_own_phone) score += 1;
  if (row.phone) score += 1;
  if (!row.chain) score += 1;
  if (row.spanish && /spanish|español/.test(query.toLowerCase())) score += 4;
  if (row.chain && /independent|owner|shop|small/.test(query.toLowerCase())) score -= 3;
  return score;
}

function byRules(rows: Prospect[], query: string): RankedProspect[] {
  return rows
    .map((row) => ({ ...row, signal: rulesScore(row, query) }))
    .sort((a, b) => b.signal - a.signal || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function catalogText(rows: Prospect[]): string {
  return rows
    .map((row) => {
      const phone = row.phone ? `phone ${row.phone}` : "no phone";
      const shop = row.chain ? "chain" : "independent";
      const language = row.spanish ? "Spanish spoken" : "English only";
      const desk = row.answers_own_phone ? "owner answers the phone" : "phone often unanswered";
      return `${row.id}| ${row.name} | ${row.trade} | ${row.city} | ${phone} | ${shop} | ${language} | ${desk} | ${row.notes}`;
    })
    .join("\n");
}

function questionsFor(query: string, rows: Prospect[]): Record<string, unknown> {
  const criteria: Record<string, null> = {};
  for (const row of rows) criteria[row.id] = null;
  return {
    where: {
      type: "choice",
      instructions: `Which company is the best first outreach call for this request: "${query}"? Palmetto Coast offers a fictional AI receptionist to independent home-service shops that miss calls. Use only the catalog. Prefer a shop the request names. A chain, a company outside the request, or a company that already has someone answering should not rank first.`,
      criteria,
    },
    matches: {
      type: "noul",
      instructions: `Does any company in the catalog fit this outreach request: "${query}"?`,
      criteria: {
        true: "At least one company is a plausible first call for this request",
        false: "No company in the catalog fits this request",
      },
    },
  };
}

export function matchLabel(probability: number | null): string | null {
  if (probability === null) return null;
  if (probability >= 0.7) return "The no-website catalog has a company for this search.";
  if (probability < 0.35) return "No company in the no-website catalog fits this search. The first row is only the closest record.";
  return "A company partly fits. Read the notes before treating it as a lead.";
}

export async function rankProspects(query: string, options?: { maxOptions?: number }): Promise<ProspectRank> {
  const cleaned = query.trim().slice(0, 280) || DEFAULT_OUTREACH_QUERY;
  const allRows = withoutWebsite();
  const total = Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects")?.n ?? 0);
  const limit = options?.maxOptions ?? CHOICE_LIMIT;
  const narrowed = allRows.length > limit;
  const pool = narrowed ? byRules(allRows, cleaned).slice(0, limit) : allRows;
  const base = {
    query: cleaned,
    considered: pool.length,
    excludedWithWebsite: total - allRows.length,
    narrowed,
  };
  try {
    const result = await evaluateJev(catalogText(pool), questionsFor(cleaned, pool), 25000);
    const where = result.answers.where;
    const probabilities = where?.probabilities ?? {};
    const rows = pool
      .map((row) => ({ ...row, signal: Number(probabilities[row.id] ?? 0) }))
      .sort((a, b) => b.signal - a.signal || a.name.localeCompare(b.name))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    const matches = typeof result.answers.matches?.noul === "number" ? result.answers.matches.noul : null;
    return { ...base, mode: "jev", model: result.model, matches, matchLabel: matchLabel(matches), rows };
  } catch {
    return {
      ...base,
      mode: "rules",
      model: null,
      matches: null,
      matchLabel: null,
      considered: allRows.length,
      narrowed: false,
      rows: byRules(allRows, cleaned),
    };
  }
}

