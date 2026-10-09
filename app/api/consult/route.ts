import { CONSULT_PER_HOUR, parseConsult, recentConsults, submitConsult } from "@/lib/consult";
import { boot, clientIp, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "Requests are paused right now." }, 503);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ip = clientIp(request);
  const parsed = parseConsult(body, { ip, userAgent: request.headers.get("user-agent") || "" });
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const check = await verifyTurnstile(body.turnstileToken, ip);
  if (!check.ok) return json({ error: check.error }, 403);
  if (recentConsults(ip, new Date(Date.now() - 3600_000).toISOString()) >= CONSULT_PER_HOUR) {
    return json({ error: "Too many requests from this connection. Try again later." }, 429);
  }
  const result = await submitConsult(parsed);
  return result.ok ? json({ ok: true, notify: result.notify, duplicate: result.duplicate }) : json({ error: result.error }, 400);
}
