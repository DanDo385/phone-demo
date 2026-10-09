import { upgradeEmailConsent } from "@/content/consent";
import { recordConsent } from "@/lib/consents";
import { boot, clientIp, json } from "@/lib/http";
import { id } from "@/lib/ids";
import { get, run, transaction } from "@/lib/db";
import { verifyTurnstile } from "@/lib/turnstile";
import { executeUpgrade, retryUpgrade, saveUpgradeContact, upgradeById, upgradeView } from "@/lib/upgrade/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  boot();
  const row = upgradeById((await context.params).id);
  if (!row) return json({ error: "Assessment not found." }, 404);
  return json(upgradeView(row));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  boot();
  const auditId = (await context.params).id;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === "retry") {
    if (!retryUpgrade(auditId)) return json({ error: "Assessment not found." }, 404);
    const row = await executeUpgrade(auditId);
    return json(upgradeView(row));
  }
  if (body.action === "save") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email.includes("@")) return json({ error: "Enter the email that should receive the report." }, 400);
    if (body.consentVersion !== upgradeEmailConsent.version) return json({ error: "The form is out of date. Refresh and try again." }, 400);
    const ip = clientIp(request);
    const check = await verifyTurnstile(body.turnstileToken, ip);
    if (!check.ok) return json({ error: check.error }, 403);
    if (!saveUpgradeContact(auditId, email)) return json({ error: "Assessment not found." }, 404);
    const prospectId = id("pro");
    const now = new Date().toISOString();
    const existing = get("SELECT id FROM prospects WHERE idempotency_key = ?", `upgrade-${auditId}`);
    if (!existing) {
      transaction(() => {
        run(
          `INSERT INTO prospects(id, status, website, email, client_ip, source, idempotency_key, created_at, updated_at) VALUES (?, 'report', ?, ?, ?, 'upgrade', ?, ?, ?)`,
          prospectId,
          upgradeById(auditId)?.website_url || "",
          email,
          ip,
          `upgrade-${auditId}`,
          now,
          now,
        );
        recordConsent({ prospectId, consent: upgradeEmailConsent, granted: true, ip, userAgent: request.headers.get("user-agent"), at: now });
      });
    }
    return json({ ok: true, delivery: "simulated" });
  }
  return json({ error: "Unknown action." }, 400);
}
