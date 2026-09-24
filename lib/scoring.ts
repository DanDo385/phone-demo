import { all, get, run } from "./db";
import { id } from "./ids";
import { journalLines } from "./ledger";

export type JevAnswer = {
  type: "noul" | "choice" | "score";
  noul?: number;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};

type Ask = (
  state: unknown,
  questions: Record<string, unknown>,
) => Promise<{ model: string; answers: Record<string, JevAnswer> }>;

let ask: Ask = askJev;

export function setAskForTests(next: Ask | null): void {
  ask = next ?? askJev;
}

export async function askJev(
  state: unknown,
  questions: Record<string, unknown>,
): Promise<{ model: string; answers: Record<string, JevAnswer> }> {
  const key = process.env.JEV_API_KEY;
  if (!key || process.env.VITEST) throw new Error("no_key");
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ state, model: process.env.JEV_MODEL || "jev-latest", questions }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`jev_${response.status}`);
  const body = (await response.json()) as { model?: string; answers?: Record<string, JevAnswer> };
  return { model: body.model || "jev-latest", answers: body.answers || {} };
}

export function syncCustomer(customerId: string): void {
  const customer = get<{ name: string | null; phone: string | null; email: string | null }>(
    "SELECT name, phone, email FROM customers WHERE id = ?",
    customerId,
  );
  if (!customer) return;
  const inquiry = get<{ service_address: string | null; origin: string }>(
    "SELECT service_address, origin FROM inquiries WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 1",
    customerId,
  );
  run(
    `INSERT INTO crm_profiles(customer_id, status, address, source, updated_at)
     VALUES(?, 'lead', ?, ?, ?)
     ON CONFLICT(customer_id) DO UPDATE SET
       address = COALESCE(excluded.address, crm_profiles.address),
       source = COALESCE(excluded.source, crm_profiles.source),
       updated_at = excluded.updated_at`,
    customerId,
    inquiry?.service_address ?? null,
    inquiry?.origin ?? null,
    new Date().toISOString(),
  );
  flagExactDuplicate(customerId, customer.phone, customer.email);
}

export async function reviewCustomer(customerId: string): Promise<void> {
  syncCustomer(customerId);
  const customer = get<{ name: string | null; phone: string | null; email: string | null }>(
    "SELECT name, phone, email FROM customers WHERE id = ?",
    customerId,
  );
  if (!customer) return;
  const other = otherCustomer(customerId, customer.phone, customer.email);
  if (!other) return;
  const questions = {
    same_person: {
      type: "noul",
      instructions: {
        candidate: customer,
        existing: other,
        question: "Is `candidate` the same person as `existing`?",
      },
      criteria: { true: "Same phone, email, or unmistakable identity", false: "Different person" },
    },
  };
  const scored = await score("customer", customerId, "same_person", { candidate: customer, existing: other }, questions);
  const noul = scored.answers.same_person?.noul ?? 0;
  if (noul >= 0.8) openFlag("customer", customerId, "duplicate", `Jev ${noul.toFixed(2)} against ${other.id}`, scored.reviewId);
}

export async function reviewInquiry(inquiryId: string): Promise<void> {
  const inquiry = get<{ issue: string | null; customer_id: string | null }>(
    "SELECT issue, customer_id FROM inquiries WHERE id = ?",
    inquiryId,
  );
  if (!inquiry) return;
  if (inquiry.customer_id) syncCustomer(inquiry.customer_id);
  const text = inquiry.issue || "";
  if (urgentRule(text)) openFlag("inquiry", inquiryId, "urgent", "Rules matched an urgent phrase", null);
  const questions = {
    urgent: {
      type: "noul",
      instructions: "Does this request need same-day owner attention?",
      criteria: { true: "Active leak, outage, hazard, or explicit urgency", false: "Routine scheduling" },
    },
  };
  const scored = await score("inquiry", inquiryId, "urgent", text, questions);
  const noul = scored.answers.urgent?.noul ?? 0;
  if (!scored.degraded && noul >= 0.8) openFlag("inquiry", inquiryId, "urgent", `Jev ${noul.toFixed(2)}`, scored.reviewId);
}

export async function reviewJournal(journalId: string): Promise<void> {
  const lines = journalLines(journalId);
  const suspense = lines.some((line) => line.account_code === "4999");
  if (suspense) openFlag("journal", journalId, "miscategorized", "A line posted to uncategorized revenue", null);
  const questions = {
    categorization: {
      type: "choice",
      instructions: "Does this posting use the right revenue accounts?",
      criteria: {
        fits: "Known service codes land on diagnostic, service, or credit accounts",
        wrong: "A known code is on the wrong account, or revenue is misstated",
        suspense: "An unknown code was parked in uncategorized revenue",
      },
    },
  };
  const scored = await score("journal", journalId, "categorization", { lines }, questions);
  const choice = scored.answers.categorization?.choice;
  const confidence = scored.answers.categorization?.confidence ?? 0;
  if (!scored.degraded && choice && choice !== "fits" && confidence >= 0.7) {
    openFlag("journal", journalId, "miscategorized", `Jev ${choice} ${confidence.toFixed(2)}`, scored.reviewId);
  }
}

export function addNote(customerId: string, author: string, body: string): void {
  const text = body.trim();
  if (!text) throw new Error("Note is empty");
  run(
    "INSERT INTO crm_notes(id, customer_id, author, body, created_at) VALUES(?, ?, ?, ?, ?)",
    id("note"),
    customerId,
    author,
    text,
    new Date().toISOString(),
  );
}

export function customerList(): Array<Record<string, unknown>> {
  return all(
    `SELECT c.id, c.name, c.phone, c.email, c.preferred_language, p.status, p.address,
            (SELECT COUNT(*) FROM inquiries i WHERE i.customer_id = c.id) AS inquiries,
            (SELECT COUNT(*) FROM flags f WHERE f.subject_id = c.id AND f.resolved_at IS NULL) AS open_flags
     FROM customers c LEFT JOIN crm_profiles p ON p.customer_id = c.id
     ORDER BY c.created_at DESC`,
  );
}

export function customerDetail(customerId: string): {
  customer: Record<string, unknown> | undefined;
  notes: Array<Record<string, unknown>>;
  inquiries: Array<Record<string, unknown>>;
  flags: Array<Record<string, unknown>>;
} {
  return {
    customer: get("SELECT c.*, p.status, p.address, p.source FROM customers c LEFT JOIN crm_profiles p ON p.customer_id = c.id WHERE c.id = ?", customerId),
    notes: all("SELECT * FROM crm_notes WHERE customer_id = ? ORDER BY created_at DESC", customerId),
    inquiries: all("SELECT id, issue, status, created_at FROM inquiries WHERE customer_id = ? ORDER BY created_at DESC", customerId),
    flags: all("SELECT * FROM flags WHERE subject_type = 'customer' AND subject_id = ? ORDER BY created_at DESC", customerId),
  };
}

export function openFlags(): Array<Record<string, unknown>> {
  return all("SELECT * FROM flags WHERE resolved_at IS NULL ORDER BY created_at DESC");
}

async function score(
  subjectType: string,
  subjectId: string,
  question: string,
  state: unknown,
  questions: Record<string, unknown>,
): Promise<{ degraded: boolean; reviewId: string | null; answers: Record<string, JevAnswer> }> {
  try {
    const result = await ask(state, questions);
    const reviewId = storeReview(subjectType, subjectId, question, result.answers, false, result.model);
    return { degraded: false, reviewId, answers: result.answers };
  } catch {
    const reviewId = storeReview(subjectType, subjectId, question, {}, true, "rules");
    return { degraded: true, reviewId, answers: {} };
  }
}

function storeReview(
  subjectType: string,
  subjectId: string,
  question: string,
  answers: Record<string, JevAnswer>,
  degraded: boolean,
  model: string,
): string {
  const reviewId = id("rev");
  run(
    "INSERT INTO reviews(id, subject_type, subject_id, question, answer_json, degraded, model, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
    reviewId,
    subjectType,
    subjectId,
    question,
    JSON.stringify(answers),
    degraded ? 1 : 0,
    model,
    new Date().toISOString(),
  );
  return reviewId;
}

function openFlag(subjectType: string, subjectId: string, kind: string, detail: string, reviewId: string | null): void {
  const existing = get(
    "SELECT id FROM flags WHERE subject_type = ? AND subject_id = ? AND kind = ? AND resolved_at IS NULL",
    subjectType,
    subjectId,
    kind,
  );
  if (existing) return;
  run(
    "INSERT INTO flags(id, subject_type, subject_id, kind, detail, review_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)",
    id("flag"),
    subjectType,
    subjectId,
    kind,
    detail,
    reviewId,
    new Date().toISOString(),
  );
}

function flagExactDuplicate(customerId: string, phone: string | null, email: string | null): void {
  const other = otherCustomer(customerId, phone, email);
  if (!other) return;
  openFlag("customer", customerId, "duplicate", `Same phone or email as ${other.id}`, null);
}

function otherCustomer(
  customerId: string,
  phone: string | null,
  email: string | null,
): { id: string; name: string | null; phone: string | null; email: string | null } | undefined {
  const phoneKey = digits(phone);
  const emailKey = email?.trim().toLowerCase() || "";
  if (!phoneKey && !emailKey) return;
  const rows = all<{ id: string; name: string | null; phone: string | null; email: string | null }>(
    "SELECT id, name, phone, email FROM customers WHERE id != ?",
    customerId,
  );
  return rows.find((row) => (phoneKey && digits(row.phone) === phoneKey) || (emailKey && (row.email || "").trim().toLowerCase() === emailKey));
}

function urgentRule(text: string): boolean {
  return /leak|flood|burst|no water|gas|spark|urgent|emergency|help!/i.test(text);
}

function digits(value: string | null): string {
  return (value || "").replace(/\D/g, "");
}
