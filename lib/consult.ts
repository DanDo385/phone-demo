import { consultEmailConsent } from "@/content/consent";
import { TRADES } from "@/content/marketing/trades";
import { recordConsent } from "./consents";
import { get, run, transaction } from "./db";
import { id } from "./ids";
import { sendAgentMail } from "./providers/agentmail";
import { agentMailReady } from "./providers/status";

export const CONSULT_PER_HOUR = 8;

export type ConsultInput = {
  name: string;
  email: string;
  business: string;
  industry: string;
  note: string;
  consentVersion: string;
  idempotencyKey: string;
  ip: string;
  userAgent: string;
};

export function recentConsults(ip: string, sinceIso: string): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects WHERE source = 'consult' AND client_ip = ? AND created_at >= ?", ip, sinceIso)?.n ?? 0;
}

export function parseConsult(body: Record<string, unknown>, meta: { ip: string; userAgent: string }): ConsultInput | { error: string } {
  const name = text(body.name, 120);
  const email = text(body.email, 160).toLowerCase();
  const business = text(body.business, 160);
  const industry = text(body.industry, 80);
  const note = text(body.note, 2000);
  const idempotencyKey = text(body.idempotencyKey, 80);
  if (!name || !email.includes("@") || !note || idempotencyKey.length < 16) return { error: "Add your name, a real email, and a short note." };
  if (industry && !TRADES.some((trade) => trade.value === industry)) return { error: "Choose an industry from the list." };
  if (body.consentVersion !== consultEmailConsent.version) return { error: "The form is out of date. Refresh the page and try again." };
  return { name, email, business, industry, note, consentVersion: consultEmailConsent.version, idempotencyKey, ip: meta.ip, userAgent: meta.userAgent };
}

export async function submitConsult(input: ConsultInput): Promise<{ ok: true; duplicate: boolean; notify: "simulated" | "sent" | "failed" } | { ok: false; error: string }> {
  const existing = get<{ id: string; notify_status: string | null }>("SELECT id, notify_status FROM prospects WHERE idempotency_key = ?", input.idempotencyKey);
  if (existing) return { ok: true, duplicate: true, notify: (existing.notify_status as "simulated" | "sent" | "failed") || "simulated" };
  const prospectId = id("pro");
  const now = new Date().toISOString();
  transaction(() => {
    run(
      `INSERT INTO prospects(id, status, website, email, client_ip, owner_name, trade, source, business_name, intake_json, idempotency_key, created_at, updated_at)
       VALUES (?, 'contact', '', ?, ?, ?, ?, 'consult', ?, ?, ?, ?, ?)`,
      prospectId,
      input.email,
      input.ip,
      input.name,
      input.industry || null,
      input.business,
      JSON.stringify({ note: input.note }),
      input.idempotencyKey,
      now,
      now,
    );
    recordConsent({ prospectId, consent: consultEmailConsent, granted: true, ip: input.ip, userAgent: input.userAgent, at: now });
  });
  const notify = await notifyStaff(input, prospectId);
  run("UPDATE prospects SET notify_status = ?, updated_at = ? WHERE id = ?", notify, new Date().toISOString(), prospectId);
  return { ok: true, duplicate: false, notify };
}

async function notifyStaff(input: ConsultInput, prospectId: string): Promise<"simulated" | "sent" | "failed"> {
  const to = process.env.NOTIFY_EMAIL?.trim();
  if (!to || !agentMailReady()) return "simulated";
  const delivery = await sendAgentMail({
    to,
    subject: `Consultation request: ${input.business || input.name}`,
    text: [`Name: ${input.name}`, `Email: ${input.email}`, `Business: ${input.business || "not given"}`, `Industry: ${input.industry || "not given"}`, `Note: ${input.note}`, `Id: ${prospectId}`].join("\n"),
    html: `<p>${escapeHtml(input.note)}</p>`,
    labels: ["consult"],
  });
  return delivery.status;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}
