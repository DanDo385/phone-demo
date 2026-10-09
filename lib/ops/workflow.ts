import fs from "node:fs";
import path from "node:path";
import { all, get, run, transaction } from "../db";
import { id, sha256, token } from "../ids";

// Shared operations for voice, chat, the staff dashboard, the HTTP API, and the CLI.
// The database is the workflow state. Delivery is simulated, sent, or failed. Never sent on failure.

export type Priority = "high" | "normal" | "low";
export type Delivery = "simulated" | "sent" | "failed";

const IMPLEMENTED_CHANNELS = new Set(["phone", "web", "sms", "email"]);

export type InquiryFacts = {
  scope?: string;
  location?: string;
  urgency?: string;
  timing?: string;
  budget?: string;
  decisionMaker?: string;
  commercial?: boolean;
  rfp?: boolean;
  emergency?: boolean;
  audience?: "homeowner" | "commercial";
  contacts?: Array<{ name: string; role: string }>;
  statedValueLabel?: string;
};

export function filesRoot(): string {
  return process.env.OPS_FILES_DIR || path.join(process.cwd(), "data", "ops-files");
}

function iso(date = new Date()): string {
  return date.toISOString();
}

function audit(businessId: string, actor: string, action: string, subjectType: string, subjectId: string, detail: Record<string, unknown>): void {
  run(
    "INSERT INTO ops_audit(id, business_id, actor, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id("aud"),
    businessId,
    actor,
    action,
    subjectType,
    subjectId,
    JSON.stringify(detail),
    iso(),
  );
}

export function priorityFor(facts: InquiryFacts): { priority: Priority; reason: string } {
  if (facts.emergency) return { priority: "high", reason: "Emergency language. Do not book. Tell the caller to get safe and call 911 or the gas utility." };
  if (facts.rfp) return { priority: "high", reason: "The inquiry looks like an RFP or a formal commercial bid. Priority follows scope and fit. The stated project value is not booked revenue." };
  if (facts.commercial) return { priority: "high", reason: "Commercial inquiry. Priority follows service fit, scope, and urgency. Any stated project value is kept separate from booked revenue." };
  if (facts.urgency === "soon" || facts.urgency === "emergency") return { priority: "high", reason: "The timing is urgent and the request fits the business." };
  return { priority: "normal", reason: "The request fits the business. No urgent or commercial signal was recorded." };
}

export function createBusiness(input: { name: string; fictional?: boolean; industry?: string; reviewUrl?: string | null; languagesTested?: string[] }): string {
  const businessId = id("biz");
  run(
    `INSERT INTO businesses(id, name, fictional, industry, review_url, languages_tested_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    businessId,
    input.name,
    input.fictional ? 1 : 0,
    input.industry ?? null,
    input.reviewUrl ?? null,
    JSON.stringify(input.languagesTested ?? []),
    iso(),
  );
  return businessId;
}

export function createCustomer(input: { businessId: string; name: string; email?: string | null; phone?: string | null }): string {
  const customerId = id("cus");
  run(
    "INSERT INTO customer_accounts(id, business_id, name, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    customerId,
    input.businessId,
    input.name,
    input.email ?? null,
    input.phone ?? null,
    iso(),
  );
  return customerId;
}

export function createInquiry(input: { businessId: string; customerId?: string | null; channel: string; summary: string; facts?: InquiryFacts; language?: string; actor?: string }): { ok: true; id: string; priority: Priority; reason: string } | { ok: false; error: string } {
  const business = get("SELECT id FROM businesses WHERE id = ?", input.businessId);
  if (!business) return { ok: false, error: "Business not found." };
  if (input.customerId) {
    const customer = get("SELECT id FROM customer_accounts WHERE id = ? AND business_id = ?", input.customerId, input.businessId);
    if (!customer) return { ok: false, error: "Customer not found for this business." };
  }
  const facts = input.facts ?? {};
  const ranked = priorityFor(facts);
  const inquiryId = id("inq");
  const now = iso();
  transaction(() => {
    run(
      `INSERT INTO ops_inquiries(id, business_id, customer_id, channel, status, priority, priority_reason, summary, facts_json, language, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
      inquiryId,
      input.businessId,
      input.customerId ?? null,
      input.channel,
      ranked.priority,
      ranked.reason,
      input.summary,
      JSON.stringify(facts),
      input.language === "es" ? "es" : "en",
      now,
      now,
    );
    audit(input.businessId, input.actor ?? "system", "createInquiry", "inquiry", inquiryId, { channel: input.channel, priority: ranked.priority });
  });
  return { ok: true, id: inquiryId, priority: ranked.priority, reason: ranked.reason };
}

export function setInquiryLanguage(input: { businessId: string; inquiryId: string; language: "en" | "es" }): { ok: true } | { ok: false; error: string } {
  const row = get("SELECT id FROM ops_inquiries WHERE id = ? AND business_id = ?", input.inquiryId, input.businessId);
  if (!row) return { ok: false, error: "Inquiry not found." };
  run("UPDATE ops_inquiries SET language = ?, updated_at = ? WHERE id = ?", input.language, iso(), input.inquiryId);
  return { ok: true };
}

export function attachMedia(input: { businessId: string; inquiryId?: string | null; jobId?: string | null; filename: string; mediaType: string; bytes: Buffer; permission: string; actor?: string }): { ok: true; id: string; path: string } | { ok: false; error: string } {
  if (input.inquiryId && !get("SELECT id FROM ops_inquiries WHERE id = ? AND business_id = ?", input.inquiryId, input.businessId)) return { ok: false, error: "Inquiry not found." };
  if (input.jobId && !get("SELECT id FROM ops_jobs WHERE id = ? AND business_id = ?", input.jobId, input.businessId)) return { ok: false, error: "Job not found." };
  if (!input.inquiryId && !input.jobId) return { ok: false, error: "Attach the file to an inquiry or a job." };
  const safeName = path.basename(input.filename).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "file";
  const fileId = id("file");
  const relative = path.join(input.businessId, `${fileId}-${safeName}`);
  const full = path.join(filesRoot(), relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, input.bytes);
  transaction(() => {
    run(
      `INSERT INTO ops_files(id, business_id, inquiry_id, job_id, filename, media_type, bytes, storage_path, permission, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      fileId,
      input.businessId,
      input.inquiryId ?? null,
      input.jobId ?? null,
      safeName,
      input.mediaType,
      input.bytes.length,
      relative,
      input.permission,
      iso(),
    );
    audit(input.businessId, input.actor ?? "system", "attachMedia", "file", fileId, { inquiryId: input.inquiryId ?? null, jobId: input.jobId ?? null, permission: input.permission });
  });
  return { ok: true, id: fileId, path: relative };
}

export type Slot = { startsAt: string; endsAt: string };

export function checkAvailability(businessId: string, now = new Date()): Slot[] | { ok: false; error: string } {
  if (!get("SELECT id FROM businesses WHERE id = ?", businessId)) return { ok: false, error: "Business not found." };
  const slots: Slot[] = [];
  const cursor = new Date(now);
  cursor.setUTCMinutes(0, 0, 0);
  while (slots.length < 4) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) continue;
    for (const hour of [14, 18]) {
      const start = new Date(cursor);
      start.setUTCHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const clash = get(
        "SELECT id FROM ops_appointments WHERE business_id = ? AND status = 'booked' AND starts_at < ? AND ends_at > ?",
        businessId,
        end.toISOString(),
        start.toISOString(),
      );
      if (!clash) slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
      if (slots.length >= 4) break;
    }
  }
  return slots;
}

export function bookAppointment(input: { businessId: string; inquiryId: string; startsAt: string; endsAt: string; kind: string; idempotencyKey: string; actor?: string }): { ok: true; id: string; duplicate: boolean; provider: "simulated" } | { ok: false; error: string } {
  return transaction(() => {
    const inquiry = get<{ id: string }>("SELECT id FROM ops_inquiries WHERE id = ? AND business_id = ?", input.inquiryId, input.businessId);
    if (!inquiry) return { ok: false, error: "Inquiry not found." };
    const existing = get<{ id: string }>("SELECT id FROM ops_appointments WHERE business_id = ? AND idempotency_key = ?", input.businessId, input.idempotencyKey);
    if (existing) return { ok: true, id: existing.id, duplicate: true, provider: "simulated" as const };
    const clash = get(
      "SELECT id FROM ops_appointments WHERE business_id = ? AND status = 'booked' AND starts_at < ? AND ends_at > ?",
      input.businessId,
      input.endsAt,
      input.startsAt,
    );
    if (clash) return { ok: false, error: "That time is already booked." };
    const appointmentId = id("apt");
    run(
      `INSERT INTO ops_appointments(id, business_id, inquiry_id, starts_at, ends_at, kind, status, idempotency_key, provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'booked', ?, 'simulated', ?)`,
      appointmentId,
      input.businessId,
      input.inquiryId,
      input.startsAt,
      input.endsAt,
      input.kind,
      input.idempotencyKey,
      iso(),
    );
    run("UPDATE ops_inquiries SET status = 'booked', updated_at = ? WHERE id = ?", iso(), input.inquiryId);
    audit(input.businessId, input.actor ?? "system", "bookAppointment", "appointment", appointmentId, { inquiryId: input.inquiryId, provider: "simulated" });
    return { ok: true, id: appointmentId, duplicate: false, provider: "simulated" as const };
  });
}

export function startVerification(input: { businessId: string; customerId: string; now?: Date }): { ok: true; verificationId: string; code: string; delivery: Delivery; reason: string } | { ok: false; error: string } {
  const customer = get<{ email: string | null }>("SELECT email FROM customer_accounts WHERE id = ? AND business_id = ?", input.customerId, input.businessId);
  if (!customer) return { ok: false, error: "Customer not found." };
  if (!customer.email) return { ok: false, error: "This account has no verified contact on file." };
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const now = input.now ?? new Date();
  const verificationId = id("ver");
  run(
    `INSERT INTO account_verifications(id, business_id, customer_id, channel, code_hash, expires_at, created_at) VALUES (?, ?, ?, 'email', ?, ?, ?)`,
    verificationId,
    input.businessId,
    input.customerId,
    sha256(code),
    new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    iso(now),
  );
  return { ok: true, verificationId, code, delivery: "simulated", reason: "No email provider is used for this code. It is returned only to the caller that will show or send it." };
}

export function finishVerification(input: { businessId: string; customerId: string; code: string; now?: Date }): { ok: true; token: string } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  const row = get<{ id: string; expires_at: string }>(
    `SELECT id, expires_at FROM account_verifications WHERE business_id = ? AND customer_id = ? AND code_hash = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    input.businessId,
    input.customerId,
    sha256(input.code),
  );
  if (!row) return { ok: false, error: "That code does not match." };
  if (new Date(row.expires_at).getTime() < now.getTime()) return { ok: false, error: "That code has expired." };
  const raw = token();
  transaction(() => {
    run("UPDATE account_verifications SET consumed_at = ? WHERE id = ?", iso(now), row.id);
    run(
      "INSERT INTO account_sessions(id, business_id, customer_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id("ses"),
      input.businessId,
      input.customerId,
      sha256(raw),
      new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      iso(now),
    );
  });
  return { ok: true, token: raw };
}

export function lookupAuthorizedInvoice(sessionToken: string, invoiceId: string, now = new Date()): { ok: true; invoice: { id: string; externalRef: string; amountLabel: string; status: string; sourceSystem: string; illustrative: boolean } } | { ok: false; error: string } {
  const session = get<{ business_id: string; customer_id: string; expires_at: string }>(
    "SELECT business_id, customer_id, expires_at FROM account_sessions WHERE token_hash = ?",
    sha256(sessionToken),
  );
  if (!session || new Date(session.expires_at).getTime() < now.getTime()) return { ok: false, error: "Sign in required." };
  const invoice = get<{ id: string; external_ref: string; amount_label: string; status: string; source_system: string; illustrative: number }>(
    "SELECT id, external_ref, amount_label, status, source_system, illustrative FROM ops_invoices WHERE id = ? AND business_id = ? AND customer_id = ?",
    invoiceId,
    session.business_id,
    session.customer_id,
  );
  if (!invoice) return { ok: false, error: "No invoice matches this account." };
  return {
    ok: true,
    invoice: {
      id: invoice.id,
      externalRef: invoice.external_ref,
      amountLabel: invoice.amount_label,
      status: invoice.status,
      sourceSystem: invoice.source_system,
      illustrative: invoice.illustrative === 1,
    },
  };
}

export function sendCustomerMessage(input: { businessId: string; inquiryId: string; channel: string; body: string; idempotencyKey?: string; fail?: boolean; actor?: string }): { ok: true; id: string; delivery: Delivery; reason: string | null; duplicate: boolean } | { ok: false; error: string } {
  const inquiry = get("SELECT id FROM ops_inquiries WHERE id = ? AND business_id = ?", input.inquiryId, input.businessId);
  if (!inquiry) return { ok: false, error: "Inquiry not found." };
  if (input.idempotencyKey) {
    const existing = get<{ id: string; delivery: Delivery; delivery_reason: string | null }>(
      "SELECT id, delivery, delivery_reason FROM ops_messages WHERE business_id = ? AND idempotency_key = ?",
      input.businessId,
      input.idempotencyKey,
    );
    if (existing) return { ok: true, id: existing.id, delivery: existing.delivery, reason: existing.delivery_reason, duplicate: true };
  }
  let delivery: Delivery = "simulated";
  let reason: string | null = "No provider accepted this message. It is stored and marked simulated.";
  if (!IMPLEMENTED_CHANNELS.has(input.channel)) {
    delivery = "failed";
    reason = "This channel is not approved yet. Use phone, website chat, SMS, or email.";
  } else if (input.fail) {
    delivery = "failed";
    reason = "The provider did not accept the message.";
  }
  const messageId = id("msg");
  transaction(() => {
    run(
      `INSERT INTO ops_messages(id, business_id, inquiry_id, channel, direction, body, delivery, delivery_reason, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, 'out', ?, ?, ?, ?, ?)`,
      messageId,
      input.businessId,
      input.inquiryId,
      input.channel,
      input.body,
      delivery,
      reason,
      input.idempotencyKey ?? null,
      iso(),
    );
    audit(input.businessId, input.actor ?? "system", "sendCustomerMessage", "message", messageId, { delivery, channel: input.channel });
  });
  return { ok: true, id: messageId, delivery, reason, duplicate: false };
}

export function updateJob(input: { businessId: string; jobId: string; stage: string; notes?: string; actor?: string }): { ok: true } | { ok: false; error: string } {
  const job = get("SELECT id FROM ops_jobs WHERE id = ? AND business_id = ?", input.jobId, input.businessId);
  if (!job) return { ok: false, error: "Job not found." };
  run("UPDATE ops_jobs SET stage = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?", input.stage, input.notes ?? null, iso(), input.jobId);
  audit(input.businessId, input.actor ?? "system", "updateJob", "job", input.jobId, { stage: input.stage });
  return { ok: true };
}

export function createJob(input: { businessId: string; inquiryId: string; title: string; actor?: string }): { ok: true; id: string } | { ok: false; error: string } {
  if (!get("SELECT id FROM ops_inquiries WHERE id = ? AND business_id = ?", input.inquiryId, input.businessId)) return { ok: false, error: "Inquiry not found." };
  const jobId = id("job");
  const now = iso();
  run(
    "INSERT INTO ops_jobs(id, business_id, inquiry_id, title, stage, created_at, updated_at) VALUES (?, ?, ?, ?, 'inquiry', ?, ?)",
    jobId,
    input.businessId,
    input.inquiryId,
    input.title,
    now,
    now,
  );
  audit(input.businessId, input.actor ?? "system", "createJob", "job", jobId, {});
  return { ok: true, id: jobId };
}

export function recordInvoice(input: { businessId: string; customerId: string; jobId?: string | null; externalRef: string; amountLabel: string; sourceSystem: string; illustrative?: boolean }): { ok: true; id: string } | { ok: false; error: string } {
  if (!get("SELECT id FROM customer_accounts WHERE id = ? AND business_id = ?", input.customerId, input.businessId)) return { ok: false, error: "Customer not found." };
  const invoiceId = id("inv");
  run(
    `INSERT INTO ops_invoices(id, business_id, customer_id, job_id, external_ref, amount_label, status, source_system, illustrative, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)`,
    invoiceId,
    input.businessId,
    input.customerId,
    input.jobId ?? null,
    input.externalRef,
    input.amountLabel,
    input.sourceSystem,
    input.illustrative === false ? 0 : 1,
    iso(),
  );
  return { ok: true, id: invoiceId };
}

export function confirmPayment(input: { businessId: string; invoiceId: string; source: string; amountLabel: string; idempotencyKey: string; actor?: string }): { ok: true; id: string; duplicate: boolean } | { ok: false; error: string } {
  if (input.source !== "provider_event" && input.source !== "authorized_action") return { ok: false, error: "Payment is confirmed only from a provider event or an authorized recorded action." };
  return transaction(() => {
    const invoice = get<{ id: string }>("SELECT id FROM ops_invoices WHERE id = ? AND business_id = ?", input.invoiceId, input.businessId);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    const existing = get<{ id: string }>("SELECT id FROM ops_payments WHERE business_id = ? AND idempotency_key = ?", input.businessId, input.idempotencyKey);
    if (existing) return { ok: true, id: existing.id, duplicate: true };
    const paymentId = id("pay");
    run(
      `INSERT INTO ops_payments(id, business_id, invoice_id, status, source, amount_label, idempotency_key, created_at) VALUES (?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
      paymentId,
      input.businessId,
      input.invoiceId,
      input.source,
      input.amountLabel,
      input.idempotencyKey,
      iso(),
    );
    run("UPDATE ops_invoices SET status = 'paid' WHERE id = ?", input.invoiceId);
    audit(input.businessId, input.actor ?? "system", "confirmPayment", "payment", paymentId, { source: input.source });
    return { ok: true, id: paymentId, duplicate: false };
  });
}

export function requestReview(input: { businessId: string; jobId: string; customerId: string; actor?: string }): { ok: true; id: string } | { ok: false; error: string } {
  const business = get<{ review_url: string | null }>("SELECT review_url FROM businesses WHERE id = ?", input.businessId);
  if (!business) return { ok: false, error: "Business not found." };
  if (!business.review_url) return { ok: false, error: "Add the business's verified review link before sending an invitation." };
  const job = get<{ stage: string }>("SELECT stage FROM ops_jobs WHERE id = ? AND business_id = ?", input.jobId, input.businessId);
  if (!job) return { ok: false, error: "Job not found." };
  if (job.stage !== "paid" && job.stage !== "complete") return { ok: false, error: "The job is not ready for a review invitation." };
  const paid = get(
    `SELECT p.id FROM ops_payments p JOIN ops_invoices i ON i.id = p.invoice_id WHERE i.job_id = ? AND i.business_id = ? AND p.status = 'confirmed'`,
    input.jobId,
    input.businessId,
  );
  if (!paid) return { ok: false, error: "Payment is not confirmed." };
  const existing = get<{ id: string }>("SELECT id FROM ops_reviews WHERE job_id = ? AND business_id = ?", input.jobId, input.businessId);
  if (existing) return { ok: true, id: existing.id };
  const reviewId = id("rev");
  const now = iso();
  run(
    `INSERT INTO ops_reviews(id, business_id, job_id, customer_id, status, review_url, created_at, updated_at) VALUES (?, ?, ?, ?, 'sent', ?, ?, ?)`,
    reviewId,
    input.businessId,
    input.jobId,
    input.customerId,
    business.review_url,
    now,
    now,
  );
  audit(input.businessId, input.actor ?? "system", "requestReview", "review", reviewId, { policy: "neutral invitation, no incentive, customer writes the review" });
  return { ok: true, id: reviewId };
}

export function advanceReview(input: { businessId: string; reviewId: string; event: "completed" | "opt_out" | "remind" }): { ok: true; status: string } | { ok: false; error: string } {
  const row = get<{ status: string; reminders_sent: number; reminder_limit: number }>(
    "SELECT status, reminders_sent, reminder_limit FROM ops_reviews WHERE id = ? AND business_id = ?",
    input.reviewId,
    input.businessId,
  );
  if (!row) return { ok: false, error: "Invitation not found." };
  if (row.status === "completed" || row.status === "opted_out" || row.status === "limit_reached") return { ok: true, status: row.status };
  if (input.event === "completed") {
    run("UPDATE ops_reviews SET status = 'completed', updated_at = ? WHERE id = ?", iso(), input.reviewId);
    return { ok: true, status: "completed" };
  }
  if (input.event === "opt_out") {
    run("UPDATE ops_reviews SET status = 'opted_out', updated_at = ? WHERE id = ?", iso(), input.reviewId);
    return { ok: true, status: "opted_out" };
  }
  const next = row.reminders_sent + 1;
  const status = next >= row.reminder_limit ? "limit_reached" : "sent";
  run("UPDATE ops_reviews SET reminders_sent = ?, status = ?, updated_at = ? WHERE id = ?", next, status, iso(), input.reviewId);
  return { ok: true, status };
}

export type ContentConcept = {
  hook: string;
  audience: string;
  platform: string;
  goal: string;
  script: string;
  caption: string;
  cta: string;
  storyboard: string[];
  assets: string[];
  cost: string;
  extraShots: string[];
  why: string;
  illustrative: true;
};

export function generateContentOptions(input: { businessId: string; jobId: string; actor?: string }): { ok: true; ids: string[]; concepts: ContentConcept[] } | { ok: false; error: string } {
  const job = get<{ title: string; notes: string | null }>("SELECT title, notes FROM ops_jobs WHERE id = ? AND business_id = ?", input.jobId, input.businessId);
  if (!job) return { ok: false, error: "Job not found." };
  const files = getAllFiles(input.businessId, input.jobId);
  const note = job.notes?.trim() || "No job note was recorded.";
  const concepts: ContentConcept[] = [
    concept("Transformation reveal", "Homeowners comparing roofers", "Short video", "Estimate requests", `Open on the condition that was documented, then the finished work. Narration stays inside this note: ${note}`, files, "The job already has a before and an after. The structure is a reveal, not a copied video."),
    concept("What the visit covered", "Commercial decision-makers", "Photo carousel", "Qualified commercial conversations", `Walk through the documented scope without adding a warranty or a savings claim. Note on file: ${note}`, files, "A commercial reader needs the scope and the people involved more than a dramatic reveal."),
    concept("A question customers ask", "People researching the service", "Educational still", "Clearer inquiries", `Answer one question using only the note on this job: ${note}`, files, "Teaching from a real job is more useful than a generic tip, as long as the claim stays inside the note."),
  ];
  const ids: string[] = [];
  transaction(() => {
    for (const conceptItem of concepts) {
      const contentId = id("cnt");
      ids.push(contentId);
      const now = iso();
      run(
        "INSERT INTO ops_content(id, business_id, job_id, concept_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)",
        contentId,
        input.businessId,
        input.jobId,
        JSON.stringify(conceptItem),
        now,
        now,
      );
    }
    audit(input.businessId, input.actor ?? "system", "generateContentOptions", "job", input.jobId, { count: ids.length, render: "not_run" });
  });
  return { ok: true, ids, concepts };
}

export function approveContent(input: { businessId: string; contentId: string; actor?: string }): { ok: true } | { ok: false; error: string } {
  const row = get("SELECT id FROM ops_content WHERE id = ? AND business_id = ?", input.contentId, input.businessId);
  if (!row) return { ok: false, error: "Content not found." };
  run("UPDATE ops_content SET status = 'approved', updated_at = ? WHERE id = ?", iso(), input.contentId);
  audit(input.businessId, input.actor ?? "owner", "approveContent", "content", input.contentId, {});
  return { ok: true };
}

export function publishContent(input: { businessId: string; contentId: string; actor?: string }): { ok: true; status: "blocked"; detail: string } | { ok: false; error: string } {
  const row = get<{ status: string }>("SELECT status FROM ops_content WHERE id = ? AND business_id = ?", input.contentId, input.businessId);
  if (!row) return { ok: false, error: "Content not found." };
  if (row.status !== "approved") return { ok: false, error: "Approve the draft before publication." };
  const detail = "No publishing credential is connected. The draft stays approved. Export it and publish it yourself, or connect a platform.";
  run(
    "INSERT INTO ops_publications(id, business_id, content_id, status, detail, created_at) VALUES (?, ?, ?, 'blocked', ?, ?)",
    id("pub"),
    input.businessId,
    input.contentId,
    detail,
    iso(),
  );
  audit(input.businessId, input.actor ?? "system", "publishContent", "content", input.contentId, { status: "blocked" });
  return { ok: true, status: "blocked", detail };
}

export function listInquiries(businessId: string): Array<{ id: string; summary: string; priority: string; priorityReason: string; channel: string; language: string; status: string }> {
  if (!get("SELECT id FROM businesses WHERE id = ?", businessId)) return [];
  return all<{ id: string; summary: string; priority: string; priority_reason: string; channel: string; language: string; status: string }>(
    "SELECT id, summary, priority, priority_reason, channel, language, status FROM ops_inquiries WHERE business_id = ? ORDER BY created_at",
    businessId,
  ).map((row) => ({
    id: row.id,
    summary: row.summary,
    priority: row.priority,
    priorityReason: row.priority_reason,
    channel: row.channel,
    language: row.language,
    status: row.status,
  }));
}

export function listAppointments(businessId: string) {
  return all<{ id: string; inquiry_id: string; starts_at: string; status: string; provider: string }>(
    "SELECT id, inquiry_id, starts_at, status, provider FROM ops_appointments WHERE business_id = ? ORDER BY starts_at",
    businessId,
  );
}

export function showJob(businessId: string, jobId: string) {
  const job = get<{ id: string; title: string; stage: string; notes: string | null; inquiry_id: string }>(
    "SELECT id, title, stage, notes, inquiry_id FROM ops_jobs WHERE id = ? AND business_id = ?",
    jobId,
    businessId,
  );
  if (!job) return null;
  return {
    job,
    files: all("SELECT id, filename, permission FROM ops_files WHERE business_id = ? AND job_id = ?", businessId, jobId),
    content: all<{ id: string; status: string; concept_json: string }>("SELECT id, status, concept_json FROM ops_content WHERE business_id = ? AND job_id = ?", businessId, jobId).map((row) => ({
      id: row.id,
      status: row.status,
      concept: JSON.parse(row.concept_json) as ContentConcept,
    })),
    publications: all("SELECT content_id, status, detail, url FROM ops_publications WHERE business_id = ? AND content_id IN (SELECT id FROM ops_content WHERE job_id = ?)", businessId, jobId),
  };
}

function getAllFiles(businessId: string, jobId: string): string[] {
  return all<{ filename: string }>("SELECT filename FROM ops_files WHERE business_id = ? AND (job_id = ? OR inquiry_id IN (SELECT inquiry_id FROM ops_jobs WHERE id = ?))", businessId, jobId, jobId).map((row) => row.filename);
}

function concept(hook: string, audience: string, platform: string, goal: string, script: string, assets: string[], why: string): ContentConcept {
  return {
    hook,
    audience,
    platform,
    goal,
    script,
    caption: "Draft caption from the job note. It is not published.",
    cta: "Request an estimate",
    storyboard: ["Open on the documented condition", "Show only files marked usable", "End on the ask, with no performance claim"],
    assets,
    cost: "Generation was not run. No provider charge in this step.",
    extraShots: ["A detail the note mentions but no file shows yet."],
    why,
    illustrative: true,
  };
}
