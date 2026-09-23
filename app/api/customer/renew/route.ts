import { continuationDraft } from "@/lib/copy";
import { get, run } from "@/lib/db";
import { appBaseUrl, id } from "@/lib/ids";
import { boot, json } from "@/lib/http";
import { deliverEmail } from "@/lib/providers/agentmail";
import { mailConfigured } from "@/lib/providers/status";
import { issueToken, nowIso } from "@/lib/records";

export async function POST(request: Request) {
  boot();
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const customer = get<{ id: string }>("SELECT id FROM customers WHERE lower(email) = ?", email);
  if (!customer) return json({ ok: true, message: "If that email matches a request, a fresh link is prepared." });
  const inquiry = get<{ id: string; preferred_language: string; issue: string | null; facts_json: string }>(
    "SELECT id, preferred_language, issue, facts_json FROM inquiries WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 1",
    customer.id,
  );
  if (!inquiry) return json({ ok: true, message: "If that email matches a request, a fresh link is prepared." });
  run("UPDATE access_tokens SET revoked_at = ? WHERE inquiry_id = ? AND purpose = 'continuation' AND revoked_at IS NULL", nowIso(), inquiry.id);
  const raw = issueToken(inquiry.id, "continuation");
  const link = `${appBaseUrl()}/c/${raw}`;
  const facts = JSON.parse(inquiry.facts_json) as { name?: string; issue?: string };
  const draft = continuationDraft({
    lang: inquiry.preferred_language === "es" ? "es" : "en",
    name: facts.name,
    issue: facts.issue || inquiry.issue || undefined,
    link,
  });
  const sent = await deliverEmail({
    to: email,
    subject: draft.subject,
    text: draft.text,
    html: draft.html,
    mode: mailConfigured() ? "connected" : "simulated",
  });
  run(
    `INSERT INTO emails(id, inquiry_id, kind, to_address, subject, text_body, html_body, language, status, provider, error, created_at, idempotency_key)
     VALUES(?, ?, 'renewal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id("em"),
    inquiry.id,
    email,
    draft.subject,
    draft.text,
    draft.html,
    draft.language,
    sent.status,
    sent.provider,
    sent.error ?? null,
    nowIso(),
    `renew:${inquiry.id}:${Date.now()}`,
  );
  return json({
    ok: sent.status !== "failed",
    status: sent.status,
    link: sent.status === "simulated" ? link : undefined,
    message: sent.status === "simulated" ? "Simulated preview only. The message was not delivered." : "A fresh link was sent to the designated test inbox.",
  });
}
