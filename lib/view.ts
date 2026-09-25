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
  const continuation = emails.find((row) => (row as { kind: string }).kind === "continuation") as { status?: string; error?: string | null } | undefined;
  const linkOpened = events.some((row) => (row as { kind: string }).kind === "link_opened");
  const bookingFailed = tools.some((row) => (row as { name: string; status: string }).name === "book_appointment" && (row as { status: string }).status === "failed");
  const reminder = jobs.find((row) => (row as { kind: string }).kind === "review_reminder") as { status?: string } | undefined;
  const active = sessions.some((row) => (row as { status: string }).status === "active");
  const callFailed = events.some((row) => {
    const kind = (row as { kind: string }).kind;
    return kind === "forward_failed" || kind === "call_failed";
  });
  const booked = appointments.some((row) => (row as { status: string }).status === "booked");
  const calendarEvent = appointments.some((row) => Boolean((row as { google_event_id?: string | null }).google_event_id));
  const stages = deriveStages({
    hasSession: sessions.length > 0,
    sessionActive: active,
    callFailed,
    continuationStatus: continuation?.status ?? null,
    linkOpened,
    scheduling: Boolean(inquiry.calendar_revealed),
    appointment: booked,
    bookingFailed: bookingFailed && !booked,
    calendarEvent,
    invoiceStatus: invoice ? String((invoice as { status: string }).status) : null,
    reviewStatus: review ? String((review as { status: string }).status) : null,
    reminderStatus: reminder?.status ?? null,
  });
  if (continuation?.status === "failed" && continuation.error) {
    const emailStage = stages.find((stage) => stage.key === "email");
    if (emailStage) emailStage.detail = `Continuation email failed · ${continuation.error}`;
  }
  const origins = new Set(events.map((row) => (row as { source_kind: string }).source_kind));
  const accepted =
    emails.some((row) => {
      const status = (row as { status?: string }).status;
      return status === "sent" || status === "delivered";
    }) || calendarEvent;
  const telephone = sessions.some((row) => {
    const channel = String((row as { channel?: string }).channel || "");
    const provider = String((row as { provider?: string }).provider || "");
    return provider === "twilio" || channel === "telephone" || channel === "twilio";
  });
  const localPortal = events.some((row) => {
    const kind = (row as { kind?: string }).kind;
    return (row as { source_kind?: string }).source_kind === "live" && (kind === "attachment" || kind === "link_opened");
  });
  const providerLive = accepted || telephone;
  const mode = providerLive ? "live" : origins.has("simulated_replay") ? "simulated_replay" : "simulated";
  const modeNote = accepted
    ? "A provider accepted a result. This is not a payment or a dispatch."
    : telephone
      ? "Telephone session recorded. This is not a payment or a dispatch."
      : localPortal
        ? "A local continuation page is not a live provider result."
        : null;
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
    mode,
    modeNote,
  };
}

const INQUIRY_LIST_CAP = 40;

export function inquiryList() {
  const rows = all(
    `SELECT i.id, i.status, i.preferred_language, i.issue, i.origin, i.updated_at, c.name, c.phone,
            EXISTS(SELECT 1 FROM tool_executions t WHERE t.inquiry_id = i.id AND t.status = 'failed') AS tool_failed,
            EXISTS(SELECT 1 FROM emails e WHERE e.inquiry_id = i.id AND e.status = 'failed') AS email_failed
     FROM inquiries i LEFT JOIN customers c ON c.id = i.customer_id
     ORDER BY i.updated_at DESC LIMIT ?`,
    INQUIRY_LIST_CAP,
  );
  const total = Number(get<{ n: number }>("SELECT COUNT(*) AS n FROM inquiries")?.n ?? rows.length);
  return { rows, total, cap: INQUIRY_LIST_CAP };
}

export function statusPayload() {
  return { integrations: reports(), database: "sqlite", demoOffsetMs: getDemoOffset() };
}
