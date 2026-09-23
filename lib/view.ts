import { all, get } from "./db";
import { deriveStages } from "./stages";
import { getDemoOffset } from "./records";
import { reports } from "./providers/status";

export function inquiryView(inquiryId: string) {
  const inquiry = get<Record<string, unknown>>("SELECT * FROM inquiries WHERE id = ?", inquiryId);
  if (!inquiry) return null;
  const customer = inquiry.customer_id
    ? get("SELECT * FROM customers WHERE id = ?", String(inquiry.customer_id))
    : null;
  const sessions = all("SELECT * FROM sessions WHERE inquiry_id = ? ORDER BY started_at", inquiryId);
  const turns = all(
    `SELECT t.*, tr.text AS translation_text, tr.status AS translation_status, tr.source AS translation_source
     FROM transcript_turns t
     LEFT JOIN translations tr ON tr.turn_id = t.id AND tr.language = 'en'
     WHERE t.inquiry_id = ? ORDER BY t.ordinal`,
    inquiryId,
  );
  const tools = all("SELECT * FROM tool_executions WHERE inquiry_id = ? ORDER BY started_at", inquiryId);
  const events = all("SELECT * FROM timeline_events WHERE inquiry_id = ? ORDER BY created_at", inquiryId);
  const languages = all("SELECT * FROM language_events WHERE inquiry_id = ? ORDER BY created_at", inquiryId);
  const emails = all("SELECT * FROM emails WHERE inquiry_id = ? ORDER BY created_at", inquiryId);
  const appointments = all("SELECT * FROM appointments WHERE inquiry_id = ? ORDER BY starts_at", inquiryId);
  const attachments = all("SELECT id, filename, content_type, size_bytes, caption, created_at, source_kind FROM attachments WHERE inquiry_id = ?", inquiryId);
  const invoice = get("SELECT * FROM invoices WHERE inquiry_id = ?", inquiryId);
  const lines = invoice ? all("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position", String((invoice as { id: string }).id)) : [];
  const review = get("SELECT * FROM review_invitations WHERE inquiry_id = ?", inquiryId);
  const reviewEvents = all("SELECT * FROM review_events WHERE inquiry_id = ? ORDER BY created_at", inquiryId);
  const jobs = all("SELECT * FROM scheduled_jobs WHERE inquiry_id = ? ORDER BY created_at", inquiryId);
  const continuation = emails.find((row) => (row as { kind: string }).kind === "continuation") as { status?: string } | undefined;
  const linkOpened = events.some((row) => (row as { kind: string }).kind === "link_opened");
  const bookingFailed = tools.some((row) => (row as { name: string; status: string }).name === "book_appointment" && (row as { status: string }).status === "failed");
  const reminder = jobs.find((row) => (row as { kind: string }).kind === "review_reminder") as { status?: string } | undefined;
  const active = sessions.some((row) => (row as { status: string }).status === "active");
  const stages = deriveStages({
    hasSession: sessions.length > 0,
    sessionActive: active,
    callFailed: false,
    continuationStatus: continuation?.status ?? null,
    linkOpened,
    scheduling: Boolean(inquiry.calendar_revealed),
    appointment: appointments.some((row) => (row as { status: string }).status === "booked"),
    bookingFailed: bookingFailed && !appointments.some((row) => (row as { status: string }).status === "booked"),
    invoiceStatus: invoice ? String((invoice as { status: string }).status) : null,
    reviewStatus: review ? String((review as { status: string }).status) : null,
    reminderStatus: reminder?.status ?? null,
  });
  const origins = new Set(events.map((row) => (row as { source_kind: string }).source_kind));
  return {
    inquiry,
    customer,
    sessions,
    turns,
    tools,
    events,
    languages,
    emails,
    appointments,
    attachments,
    invoice,
    lines,
    review,
    reviewEvents,
    jobs,
    stages,
    demoOffsetMs: getDemoOffset(),
    mode: origins.has("live") ? "live" : origins.has("simulated_replay") ? "simulated_replay" : "simulated",
  };
}

export function inquiryList() {
  return all(
    `SELECT i.id, i.status, i.preferred_language, i.issue, i.origin, i.updated_at, c.name, c.phone
     FROM inquiries i LEFT JOIN customers c ON c.id = i.customer_id
     ORDER BY i.updated_at DESC LIMIT 40`,
  );
}

export function statusPayload() {
  return { integrations: reports(), database: "sqlite", demoOffsetMs: getDemoOffset() };
}
