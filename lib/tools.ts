import { addressInServiceArea, serviceByCode, technicianForTrade } from "./business";
import { confirmationDraft, continuationDraft } from "./copy";
import { calculateEstimate } from "./estimate";
import { appBaseUrl, id } from "./ids";
import { deliverEmail } from "./providers/agentmail";
import { googleFreeBusy, googleInsertEvent } from "./providers/google";
import { googleConfigured } from "./providers/status";
import { describeTechnicianLanguage, findConflict, listSlots, slotFits } from "./scheduling";
import { formatSpoken, plusMinutes } from "./time";
import {
  addTimeline,
  demoNow,
  finishTool,
  inquiryById,
  issueToken,
  listBusy,
  nowIso,
  startTool,
} from "./records";
import { get, run, transaction } from "./db";
import { reviewCustomer, reviewInquiry } from "./scoring";
import type { SourceKind, ToolCall, ToolResult } from "./types";

export async function executeTool(input: {
  inquiryId: string;
  sessionId?: string;
  sourceKind: SourceKind;
  delivery: "simulated" | "connected";
  call: ToolCall;
}): Promise<ToolResult> {
  const started = Date.now();
  const handle = startTool({
    inquiryId: input.inquiryId,
    sessionId: input.sessionId,
    name: input.call.name,
    args: input.call.args,
    idempotencyKey: input.call.idempotencyKey,
    sourceKind: input.sourceKind,
  });
  if (handle.duplicate) {
    const previous = handle.duplicate.result_json ? (JSON.parse(handle.duplicate.result_json) as Record<string, unknown>) : undefined;
    return {
      name: input.call.name,
      ok: handle.duplicate.status === "succeeded",
      data: previous,
      error: handle.duplicate.error ?? undefined,
      duplicate: true,
    };
  }
  try {
    const result = await perform(input);
    finishTool(handle.id, { ok: result.ok, result: result.data, error: result.error, startedAt: started });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool failed";
    finishTool(handle.id, { ok: false, error: message, startedAt: started });
    return { name: input.call.name, ok: false, error: message };
  }
}

async function perform(input: {
  inquiryId: string;
  sourceKind: SourceKind;
  delivery: "simulated" | "connected";
  call: ToolCall;
}): Promise<ToolResult> {
  const args = input.call.args;
  const inquiry = inquiryById(input.inquiryId);
  if (!inquiry) return { name: input.call.name, ok: false, error: "Inquiry not found", code: "not_found" };
  switch (input.call.name) {
    case "save_customer_details": {
      const saved = saveDetails(input.inquiryId, args, input.sourceKind);
      if (inquiry.customer_id) await reviewCustomer(inquiry.customer_id);
      await reviewInquiry(input.inquiryId);
      return saved;
    }
    case "lookup_service_info":
      return lookup(String(args.topic ?? args.service_code ?? ""));
    case "calculate_estimate":
      return estimate(String(args.service_code ?? inquiry.service_code ?? ""));
    case "send_continuation_link":
      return sendContinuation(input.inquiryId, input.delivery, input.sourceKind, String(args.email ?? ""));
    case "check_availability":
      return checkAvailability(input.inquiryId, String(args.service_code ?? inquiry.service_code ?? ""), input.sourceKind);
    case "book_appointment":
      return book(input.inquiryId, String(args.starts_at ?? ""), String(args.service_code ?? inquiry.service_code ?? ""), input.delivery, input.sourceKind);
    case "request_human_followup":
      return followup(input.inquiryId, String(args.reason ?? "Follow-up requested"), input.sourceKind);
    default:
      return { name: input.call.name, ok: false, error: "Unknown tool" };
  }
}

function saveDetails(inquiryId: string, args: Record<string, unknown>, sourceKind: SourceKind): ToolResult {
  const inquiry = inquiryById(inquiryId)!;
  const facts = JSON.parse(inquiry.facts_json) as Record<string, unknown>;
  const name = stringOrUndefined(args.name);
  const phone = stringOrUndefined(args.phone);
  const email = stringOrUndefined(args.email);
  const address = stringOrUndefined(args.address);
  const issue = stringOrUndefined(args.issue);
  const serviceCode = stringOrUndefined(args.service_code);
  const language = args.preferred_language === "es" ? "es" : inquiry.preferred_language;
  if (name) facts.name = name;
  if (phone) facts.phone = phone;
  if (email) facts.email = email;
  if (address) {
    facts.address = address;
    facts.inServiceArea = addressInServiceArea(address);
  }
  if (issue) facts.issue = issue;
  if (serviceCode && serviceByCode(serviceCode)) facts.serviceCode = serviceCode;
  run(
    `UPDATE inquiries SET facts_json = ?, issue = COALESCE(?, issue), service_code = COALESCE(?, service_code),
     service_address = COALESCE(?, service_address), in_service_area = ?, preferred_language = ?, updated_at = ? WHERE id = ?`,
    JSON.stringify(facts),
    issue ?? null,
    (facts.serviceCode as string) ?? null,
    address ?? null,
    facts.inServiceArea == null ? null : facts.inServiceArea ? 1 : 0,
    language,
    nowIso(),
    inquiryId,
  );
  if (inquiry.customer_id) {
    run(
      "UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email), preferred_language = ? WHERE id = ?",
      name ?? null,
      phone ?? null,
      email ?? null,
      language,
      inquiry.customer_id,
    );
  }
  addTimeline({ inquiryId, kind: "customer_saved", title: "Customer details saved", sourceKind });
  return { name: "save_customer_details", ok: true, data: { saved: true } };
}

function lookup(topic: string): ToolResult {
  const service = serviceByCode(topic);
  if (!service) return { name: "lookup_service_info", ok: false, error: "No matching service", code: "unknown_service" };
  return {
    name: "lookup_service_info",
    ok: true,
    data: {
      code: service.code,
      kind: service.kind,
      name_en: service.name.en,
      name_es: service.name.es,
      assumptions_en: service.assumptions.en,
      assumptions_es: service.assumptions.es,
      exclusions_en: service.exclusions.en,
      exclusions_es: service.exclusions.es,
    },
  };
}

function estimate(serviceCode: string): ToolResult {
  const value = calculateEstimate(serviceCode);
  if ("error" in value) return { name: "calculate_estimate", ok: false, error: value.error, code: "unknown_service" };
  return {
    name: "calculate_estimate",
    ok: true,
    data: {
      service_code: value.serviceCode,
      kind: value.kind,
      total_cents: value.totalCents,
      currency: "USD",
      firm: value.firm,
      lines: value.lines,
      speech_en: value.speech.en,
      speech_es: value.speech.es,
    },
  };
}

async function sendContinuation(inquiryId: string, delivery: "simulated" | "connected", sourceKind: SourceKind, email: string): Promise<ToolResult> {
  const inquiry = inquiryById(inquiryId)!;
  if (!email || !email.includes("@")) return { name: "send_continuation_link", ok: false, error: "A valid email is required", code: "invalid_email" };
  const existing = get<{ id: string; status: string; provider_message_id: string | null }>(
    "SELECT id, status, provider_message_id FROM emails WHERE inquiry_id = ? AND idempotency_key = ?",
    inquiryId,
    `continuation:${inquiryId}:${email.toLowerCase()}`,
  );
  if (existing) {
    return {
      name: "send_continuation_link",
      ok: existing.status !== "failed",
      data: { email_id: existing.id, status: existing.status, message_id: existing.provider_message_id },
      duplicate: true,
    };
  }
  const raw = issueToken(inquiryId, "continuation");
  const link = `${appBaseUrl()}/c/${raw}`;
  const facts = JSON.parse(inquiry.facts_json) as { name?: string; issue?: string };
  const draft = continuationDraft({
    lang: inquiry.preferred_language,
    name: facts.name,
    issue: facts.issue ?? inquiry.issue ?? undefined,
    link,
  });
  const sent = await deliverEmail({ to: email, subject: draft.subject, text: draft.text, html: draft.html, mode: delivery });
  const emailId = id("em");
  run(
    `INSERT INTO emails(id, inquiry_id, kind, to_address, subject, text_body, html_body, language, status, provider, provider_message_id, provider_thread_id, error, created_at, idempotency_key)
     VALUES(?, ?, 'continuation', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    emailId,
    inquiryId,
    email,
    draft.subject,
    draft.text,
    draft.html,
    draft.language,
    sent.status,
    sent.provider,
    sent.messageId ?? null,
    sent.threadId ?? null,
    sent.error ?? null,
    nowIso(),
    `continuation:${inquiryId}:${email.toLowerCase()}`,
  );
  addTimeline({
    inquiryId,
    kind: "continuation_email",
    title: sent.status === "failed" ? "Continuation email failed" : "Continuation email prepared",
    detail: sent.status,
    sourceKind,
    data: { email_id: emailId, status: sent.status },
  });
  if (sent.status === "failed") {
    return { name: "send_continuation_link", ok: false, error: sent.error, code: "email_failed", data: { email_id: emailId, status: "failed" } };
  }
  return {
    name: "send_continuation_link",
    ok: true,
    data: { email_id: emailId, status: sent.status, message_id: sent.messageId ?? null, link_issued: true },
  };
}

async function checkAvailability(inquiryId: string, serviceCode: string, sourceKind: SourceKind): Promise<ToolResult> {
  const service = serviceByCode(serviceCode);
  if (!service) return { name: "check_availability", ok: false, error: "Unknown service", code: "unknown_service" };
  const now = demoNow();
  let busy = listBusy();
  if (googleConfigured()) {
    const remote = await googleFreeBusy(now, new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000));
    if (!remote.ok) return { name: "check_availability", ok: false, error: remote.error, code: "calendar_unavailable" };
    const tech = technicianForTrade(service.trade);
    busy = busy.concat(remote.busy.map((item) => ({ technicianId: tech.id, start: item.start, end: item.end })));
  }
  const slots = listSlots({ now, serviceCode, busy, limit: 24, days: 10 });
  run("UPDATE inquiries SET calendar_revealed = 1, updated_at = ? WHERE id = ?", nowIso(), inquiryId);
  addTimeline({ inquiryId, kind: "availability", title: "Availability checked", detail: `${slots.length} openings`, sourceKind });
  return { name: "check_availability", ok: true, data: { slots, calendar: googleConfigured() ? "google" : "local_demo" } };
}

async function book(
  inquiryId: string,
  startsAt: string,
  serviceCode: string,
  delivery: "simulated" | "connected",
  sourceKind: SourceKind,
): Promise<ToolResult> {
  const inquiry = inquiryById(inquiryId)!;
  const service = serviceByCode(serviceCode);
  if (!service) return { name: "book_appointment", ok: false, error: "Unknown service", code: "unknown_service" };
  const facts = JSON.parse(inquiry.facts_json) as {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    issue?: string;
    inServiceArea?: boolean;
  };
  if (!facts.address || facts.inServiceArea === false) {
    return { name: "book_appointment", ok: false, error: "The address is not in the service area", code: "outside_area" };
  }
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime()) || !slotFits(start, service.durationMinutes)) {
    return { name: "book_appointment", ok: false, error: "That time is outside business hours", code: "outside_hours" };
  }
  const end = plusMinutes(start, service.durationMinutes);
  const tech = technicianForTrade(service.trade);
  const existing = get<{ id: string }>(
    "SELECT id FROM appointments WHERE inquiry_id = ? AND starts_at = ? AND status = 'booked'",
    inquiryId,
    start.toISOString(),
  );
  if (existing) {
    return {
      name: "book_appointment",
      ok: true,
      duplicate: true,
      data: appointmentPayload(existing.id, tech.name, tech.id, start, inquiry.preferred_language),
    };
  }
  let busy = listBusy();
  if (googleConfigured()) {
    const remote = await googleFreeBusy(new Date(start.getTime() - 60 * 60 * 1000), new Date(end.getTime() + 60 * 60 * 1000));
    if (!remote.ok) return { name: "book_appointment", ok: false, error: remote.error, code: "calendar_unavailable" };
    busy = busy.concat(remote.busy.map((item) => ({ technicianId: tech.id, start: item.start, end: item.end })));
  }
  const conflict = findConflict({ technicianId: tech.id, start, end, busy });
  if (conflict) {
    return { name: "book_appointment", ok: false, error: "That time conflicts with another appointment", code: "conflict" };
  }
  let googleEventId: string | null = null;
  // Replays and simulated turns never write to the real calendar, matching email delivery.
  const useGoogle = googleConfigured() && delivery === "connected";
  let calendarSource: SourceKind | "simulated" = useGoogle ? "live" : "simulated";
  if (useGoogle) {
    const inserted = await googleInsertEvent({
      summary: `[DEMO] ${service.name.en} — ${facts.name ?? "Customer"}`,
      description: `Inquiry ${inquiryId}\n${facts.issue ?? ""}\n${facts.address}\n${facts.phone ?? ""} ${facts.email ?? ""}\nPreferred language: ${inquiry.preferred_language}`,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    if (!inserted.ok) return { name: "book_appointment", ok: false, error: inserted.error, code: "calendar_failed" };
    googleEventId = inserted.id;
  }
  const appointmentId = id("appt");
  try {
    transaction(() => {
      run(
        `INSERT INTO appointments(id, inquiry_id, technician_id, starts_at, ends_at, status, summary, address, language, issue, customer_name, customer_phone, customer_email, source_kind, google_event_id, created_at)
         VALUES(?, ?, ?, ?, ?, 'booked', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        appointmentId,
        inquiryId,
        tech.id,
        start.toISOString(),
        end.toISOString(),
        service.name.en,
        facts.address!,
        inquiry.preferred_language,
        facts.issue ?? null,
        facts.name ?? null,
        facts.phone ?? null,
        facts.email ?? null,
        calendarSource === "live" ? "live" : "simulated",
        googleEventId,
        nowIso(),
      );
    });
  } catch {
    return { name: "book_appointment", ok: false, error: "That time was just taken", code: "conflict" };
  }
  const spoken = formatSpoken(start, inquiry.preferred_language);
  let confirmationStatus = "not_requested";
  if (facts.email) {
    const draft = confirmationDraft({ lang: inquiry.preferred_language, when: spoken, address: facts.address });
    const sent = await deliverEmail({
      to: facts.email,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
      mode: delivery,
    });
    const emailId = id("em");
    run(
      `INSERT INTO emails(id, inquiry_id, kind, to_address, subject, text_body, html_body, language, status, provider, provider_message_id, provider_thread_id, error, created_at, idempotency_key)
       VALUES(?, ?, 'confirmation', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      emailId,
      inquiryId,
      facts.email,
      draft.subject,
      draft.text,
      draft.html,
      draft.language,
      sent.status,
      sent.provider,
      sent.messageId ?? null,
      sent.threadId ?? null,
      sent.error ?? null,
      nowIso(),
      `confirmation:${inquiryId}:${start.toISOString()}`,
    );
    confirmationStatus = sent.status;
  }
  addTimeline({
    inquiryId,
    kind: "appointment_booked",
    title: "Appointment booked",
    detail: spoken,
    sourceKind: calendarSource === "live" ? "live" : sourceKind,
  });
  return {
    name: "book_appointment",
    ok: true,
    data: {
      ...appointmentPayload(appointmentId, tech.name, tech.id, start, inquiry.preferred_language),
      confirmation_status: confirmationStatus,
      calendar: useGoogle ? "google" : "local_demo",
    },
  };
}

function appointmentPayload(appointmentId: string, techName: string, techId: string, start: Date, lang: "en" | "es") {
  return {
    appointment_id: appointmentId,
    technician_name: techName,
    spoken: formatSpoken(start, lang),
    spoken_en: formatSpoken(start, "en"),
    technician_language_note: describeTechnicianLanguage(techId, lang),
    technician_language_note_en: describeTechnicianLanguage(techId, "en"),
  };
}

function followup(inquiryId: string, reason: string, sourceKind: SourceKind): ToolResult {
  run("UPDATE inquiries SET followup_requested = 1, followup_note = ?, updated_at = ? WHERE id = ?", reason, nowIso(), inquiryId);
  addTimeline({ inquiryId, kind: "followup", title: "Owner follow-up requested", detail: reason, sourceKind });
  return { name: "request_human_followup", ok: true, data: { requested: true } };
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
