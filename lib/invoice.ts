import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BUSINESS, DEMO_LABEL, serviceByCode } from "./business";
import { invoiceDraft, reviewDraft } from "./copy";
import { get, run } from "./db";
import { invoiceLinesForApproved } from "./estimate";
import { id } from "./ids";
import { formatMoney } from "./money";
import { deliverEmail } from "./providers/agentmail";
import { addTimeline, demoNow, inquiryById, issueToken, nowIso } from "./records";
import { nextSendingInstant } from "./time";
import type { SourceKind } from "./types";

export async function completeDemoService(input: {
  inquiryId: string;
  ownerName: string;
  delivery: "simulated" | "connected";
  sourceKind: SourceKind;
}): Promise<{ ok: true; invoiceId: string; number: string } | { ok: false; error: string }> {
  const inquiry = inquiryById(input.inquiryId);
  if (!inquiry) return { ok: false, error: "Inquiry not found" };
  const existing = get<{ id: string; number: string }>("SELECT id, number FROM invoices WHERE inquiry_id = ?", input.inquiryId);
  if (existing) return { ok: true, invoiceId: existing.id, number: existing.number };
  const facts = JSON.parse(inquiry.facts_json) as { serviceCode?: string; email?: string; name?: string };
  const code = facts.serviceCode || inquiry.service_code || "DIAG";
  const service = serviceByCode(code);
  if (!service) return { ok: false, error: "Unknown service" };
  if (service.kind === "inspection_required") {
    return { ok: false, error: "This work still needs an inspection. A firm invoice was not created." };
  }
  const lines = invoiceLinesForApproved(code);
  if (!lines.length) return { ok: false, error: "No approved lines" };
  const subtotal = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const tax = 0;
  const total = subtotal + tax;
  const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM invoices");
  const number = `DEMO-${1001 + (count?.n ?? 0)}`;
  const invoiceId = id("inv");
  const lang = inquiry.preferred_language;
  const banner = BUSINESS.invoiceBanner[lang];
  const dir = path.join(process.cwd(), "data", "invoices");
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, `${number}.pdf`);
  await writePdf({
    file: pdfPath,
    number,
    lang,
    banner,
    lines,
    subtotal,
    tax,
    total,
    name: facts.name ?? "Customer",
    address: inquiry.service_address ?? "",
  });
  run(
    `INSERT INTO invoices(id, inquiry_id, number, language, currency, subtotal_cents, tax_cents, total_cents, tax_note, demo_banner, status, pdf_path, created_at, approved_by)
     VALUES(?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, 'approved', ?, ?, ?)`,
    invoiceId,
    input.inquiryId,
    number,
    lang,
    subtotal,
    tax,
    total,
    BUSINESS.demoTaxNote[lang],
    banner,
    pdfPath,
    nowIso(),
    input.ownerName,
  );
  lines.forEach((line, index) => {
    run(
      "INSERT INTO invoice_lines(id, invoice_id, code, description_en, description_es, amount_cents, position) VALUES(?, ?, ?, ?, ?, ?, ?)",
      id("line"),
      invoiceId,
      line.code,
      line.description.en,
      line.description.es,
      line.amountCents,
      index,
    );
  });
  addTimeline({
    inquiryId: input.inquiryId,
    kind: "invoice_created",
    title: "Demo invoice approved",
    detail: number,
    sourceKind: input.sourceKind,
  });
  if (facts.email) {
    const draft = invoiceDraft({ lang, number, totalCents: total });
    const sent = await deliverEmail({
      to: facts.email,
      subject: draft.subject,
      text: draft.text,
      html: draft.html,
      mode: input.delivery,
    });
    run(
      `INSERT INTO emails(id, inquiry_id, kind, to_address, subject, text_body, html_body, language, status, provider, provider_message_id, error, created_at, idempotency_key)
       VALUES(?, ?, 'invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id("em"),
      input.inquiryId,
      facts.email,
      draft.subject,
      draft.text,
      draft.html,
      lang,
      sent.status,
      sent.provider,
      sent.messageId ?? null,
      sent.error ?? null,
      nowIso(),
      `invoice:${input.inquiryId}`,
    );
    const invoiceStatus = sent.status === "failed" ? "email_failed" : sent.status === "simulated" ? "simulated" : "emailed";
    run("UPDATE invoices SET status = ? WHERE id = ?", invoiceStatus, invoiceId);
    if (sent.status !== "failed") {
      await sendReviewInvitation({ inquiryId: input.inquiryId, delivery: input.delivery, sourceKind: input.sourceKind });
    }
  }
  return { ok: true, invoiceId, number };
}

export async function sendReviewInvitation(input: {
  inquiryId: string;
  delivery: "simulated" | "connected";
  sourceKind: SourceKind;
}): Promise<{ ok: boolean; error?: string }> {
  const existing = get("SELECT id FROM review_invitations WHERE inquiry_id = ?", input.inquiryId);
  if (existing) return { ok: true };
  const inquiry = inquiryById(input.inquiryId);
  if (!inquiry) return { ok: false, error: "Inquiry not found" };
  const facts = JSON.parse(inquiry.facts_json) as { email?: string };
  if (!facts.email) return { ok: false, error: "No email" };
  const raw = issueToken(input.inquiryId, "review");
  const base = `${appBase()}/review/${raw}`;
  const links = [
    { label: inquiry.preferred_language === "es" ? "Vista previa local" : "Local review preview", href: base },
    {
      label: inquiry.preferred_language === "es" ? "Vista previa tipo Google" : "Google-style preview",
      href: `${base}?platform=google`,
    },
    {
      label: inquiry.preferred_language === "es" ? "Vista previa tipo Facebook" : "Facebook-style preview",
      href: `${base}?platform=facebook`,
    },
  ];
  const draft = reviewDraft({ lang: inquiry.preferred_language, links });
  const sent = await deliverEmail({ to: facts.email, subject: draft.subject, text: draft.text, html: draft.html, mode: input.delivery });
  const emailId = id("em");
  run(
    `INSERT INTO emails(id, inquiry_id, kind, to_address, subject, text_body, html_body, language, status, provider, provider_message_id, error, created_at, idempotency_key)
     VALUES(?, ?, 'review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    emailId,
    input.inquiryId,
    facts.email,
    draft.subject,
    draft.text,
    draft.html,
    inquiry.preferred_language,
    sent.status,
    sent.provider,
    sent.messageId ?? null,
    sent.error ?? null,
    nowIso(),
    `review:${input.inquiryId}`,
  );
  const invitationId = id("rev");
  run(
    "INSERT INTO review_invitations(id, inquiry_id, language, status, email_id, created_at) VALUES(?, ?, ?, ?, ?, ?)",
    invitationId,
    input.inquiryId,
    inquiry.preferred_language,
    sent.status === "failed" ? "failed" : sent.status === "sent" ? "sent" : "simulated",
    emailId,
    nowIso(),
  );
  if (sent.status !== "failed") scheduleReminder(input.inquiryId, invitationId);
  addTimeline({
    inquiryId: input.inquiryId,
    kind: "review_invited",
    title: "Review invitation prepared",
    detail: sent.status,
    sourceKind: input.sourceKind,
  });
  return sent.status === "failed" ? { ok: false, error: sent.error } : { ok: true };
}

function scheduleReminder(inquiryId: string, invitationId: string): void {
  const target = new Date(demoNow().getTime() + BUSINESS.reviewReminderHours * 60 * 60 * 1000);
  const runAt = nextSendingInstant(target);
  run(
    `INSERT INTO scheduled_jobs(id, inquiry_id, kind, run_at, status, payload_json, idempotency_key, created_at)
     VALUES(?, ?, 'review_reminder', ?, 'pending', ?, ?, ?)`,
    id("job"),
    inquiryId,
    runAt.toISOString(),
    JSON.stringify({ invitationId }),
    `reminder:${invitationId}`,
    nowIso(),
  );
  addTimeline({
    inquiryId,
    kind: "reminder_scheduled",
    title: "Review reminder scheduled",
    detail: runAt.toISOString(),
    sourceKind: "simulated",
  });
}

function appBase(): string {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function writePdf(input: {
  file: string;
  number: string;
  lang: "en" | "es";
  banner: string;
  lines: Array<{ code: string; amountCents: number; description: { en: string; es: string } }>;
  subtotal: number;
  tax: number;
  total: number;
  name: string;
  address: string;
}): Promise<void> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw = (text: string, y: number, size = 12, heavy = false) => {
    page.drawText(text, { x: 48, y, size, font: heavy ? bold : font, color: rgb(0.08, 0.13, 0.11) });
  };
  draw(DEMO_LABEL[input.lang], 740, 9);
  draw("Palmetto Coast Home Services", 716, 18, true);
  draw(input.banner, 690, 16, true);
  draw(`${input.lang === "es" ? "Factura" : "Invoice"} ${input.number}`, 664, 12);
  draw(input.name, 640, 12);
  draw(input.address, 624, 11);
  let y = 590;
  for (const line of input.lines) {
    const label = input.lang === "es" ? line.description.es : line.description.en;
    draw(`${label}`, y, 11);
    draw(formatMoney(line.amountCents), y - 14, 11);
    y -= 36;
  }
  draw(`${input.lang === "es" ? "Subtotal" : "Subtotal"} ${formatMoney(input.subtotal)}`, y, 12, true);
  draw(`${BUSINESS.demoTaxNote[input.lang]} ${formatMoney(input.tax)}`, y - 18, 10);
  draw(`${input.lang === "es" ? "Total" : "Total"} ${formatMoney(input.total)} USD`, y - 40, 14, true);
  fs.writeFileSync(input.file, await pdf.save());
}
