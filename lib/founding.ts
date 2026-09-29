import { foundingEmailConsent, foundingSmsConsent } from "@/content/consent";
import { TRADES } from "@/content/marketing/trades";
import { brand } from "./brand";
import { recordConsent } from "./consents";
import { get, run, transaction } from "./db";
import { id } from "./ids";
import { toE164 } from "./phone";
import { sendAgentMail, type Delivery } from "./providers/agentmail";
import { agentMailReady } from "./providers/status";
import { nowIso } from "./records";

// Founding-access requests: a prospect row (source = 'founding', status = 'intake'),
// append-only consent rows with the exact text shown, and one staff notification to
// NOTIFY_EMAIL. The request's idempotency key makes a double submit return the first row.

export const FOUNDING_PER_IP_PER_HOUR = 5;

export type FoundingInput = {
  businessName: string;
  ownerName: string;
  email: string;
  mobile: string;
  smsConsent: boolean;
  trade: string;
  today: string;
  emailConsentVersion: string;
  smsConsentVersion: string;
  idempotencyKey: string;
  ip: string;
  userAgent: string;
};

export type FoundingResult =
  | { ok: true; id: string; duplicate: boolean; notify: Delivery["status"] }
  | { ok: false; status: number; error: string };

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export function parseFounding(body: Record<string, unknown>, meta: { ip: string; userAgent: string }): FoundingInput | { error: string } {
  const input: FoundingInput = {
    businessName: clean(body.businessName, 120),
    ownerName: clean(body.ownerName, 120),
    email: clean(body.email, 254).toLowerCase(),
    mobile: clean(body.mobile, 40),
    smsConsent: body.smsConsent === true,
    trade: clean(body.trade, 40),
    today: clean(body.today, 1500),
    emailConsentVersion: clean(body.emailConsentVersion, 80),
    smsConsentVersion: clean(body.smsConsentVersion, 80),
    idempotencyKey: clean(body.idempotencyKey, 80),
    ip: meta.ip,
    userAgent: meta.userAgent.slice(0, 400),
  };
  if (!input.businessName) return { error: "Enter your business name." };
  if (!input.ownerName) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return { error: "Enter a valid email address." };
  if (input.mobile && !/^\+\d{10,15}$/.test(toE164(input.mobile))) return { error: "Enter a valid mobile number, or leave it blank." };
  if (input.smsConsent && !input.mobile) return { error: "Add a mobile number to get texts, or uncheck the text box." };
  if (!TRADES.some((t) => t.value === input.trade)) return { error: "Choose your trade." };
  if (!input.today) return { error: "Tell us what happens today when you can't answer a call." };
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(input.idempotencyKey)) return { error: "Refresh the page and try again." };
  // The page must have shown the current wording; otherwise we cannot record what was agreed to.
  if (input.emailConsentVersion !== foundingEmailConsent.version) return { error: "This page is out of date. Refresh and try again." };
  if (input.mobile && input.smsConsentVersion !== foundingSmsConsent.version) return { error: "This page is out of date. Refresh and try again." };
  return input;
}

export function recentFoundingFromIp(ip: string, sinceIso: string): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects WHERE source = 'founding' AND client_ip = ? AND created_at >= ?", ip, sinceIso)?.n ?? 0;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

async function notifyStaff(input: FoundingInput, prospectId: string): Promise<Delivery> {
  const to = process.env.NOTIFY_EMAIL?.trim();
  // Same convention as every other integration: missing configuration means simulated, never "sent".
  if (!to || !agentMailReady()) return { status: "simulated", provider: "simulated" };
  const trade = TRADES.find((t) => t.value === input.trade)?.label ?? input.trade;
  const lines: Array<[string, string]> = [
    ["Business", input.businessName],
    ["Name", input.ownerName],
    ["Email", input.email],
    ["Mobile", input.mobile ? `${toE164(input.mobile)} (texts ${input.smsConsent ? "allowed" : "not allowed"})` : "not given"],
    ["Trade", trade],
    ["When they can't answer today", input.today],
    ["Prospect id", prospectId],
  ];
  return sendAgentMail({
    to,
    subject: `Founding request: ${input.businessName}`,
    text: [`New ${brand.company.name} founding-access request.`, "", ...lines.map(([k, v]) => `${k}: ${v}`)].join("\n"),
    html: `<p>New ${esc(brand.company.name)} founding-access request.</p><table>${lines
      .map(([k, v]) => `<tr><th align="left" valign="top">${esc(k)}</th><td style="white-space:pre-wrap">${esc(v)}</td></tr>`)
      .join("")}</table>`,
    labels: ["founding"],
  });
}

export async function submitFounding(input: FoundingInput): Promise<FoundingResult> {
  const existing = get<{ id: string; notify_status: string | null }>("SELECT id, notify_status FROM prospects WHERE idempotency_key = ?", input.idempotencyKey);
  if (existing) return { ok: true, id: existing.id, duplicate: true, notify: (existing.notify_status as Delivery["status"]) ?? "simulated" };

  const at = nowIso();
  const pid = id("pro");
  const mobile = input.mobile ? toE164(input.mobile) : null;
  transaction(() => {
    run(
      `INSERT INTO prospects(id, status, stage, website, email, phone_e164, client_ip, owner_name, trade, source, business_name, intake_json, idempotency_key, created_at, updated_at)
       VALUES (?, 'intake', NULL, '', ?, ?, ?, ?, ?, 'founding', ?, ?, ?, ?, ?)`,
      pid,
      input.email,
      mobile,
      input.ip,
      input.ownerName,
      input.trade,
      input.businessName,
      JSON.stringify({ when_cant_answer: input.today }),
      input.idempotencyKey,
      at,
      at,
    );
    const who = { prospectId: pid, ip: input.ip, userAgent: input.userAgent || null, at };
    recordConsent({ ...who, consent: foundingEmailConsent, granted: true });
    // Record the SMS choice whenever the box was offered (a number was given), including "no".
    if (mobile) recordConsent({ ...who, consent: foundingSmsConsent, granted: input.smsConsent });
  });

  const delivery = await notifyStaff(input, pid);
  run("UPDATE prospects SET notify_status = ?, updated_at = ? WHERE id = ?", delivery.status, nowIso(), pid);
  return { ok: true, id: pid, duplicate: false, notify: delivery.status };
}


