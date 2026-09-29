import { FOUNDING_PER_IP_PER_HOUR, parseFounding, recentFoundingFromIp, submitFounding } from "@/lib/founding";
import { boot, clientIp, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "Requests are paused right now. Try again later." }, 503);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ip = clientIp(request);
  const parsed = parseFounding(body, { ip, userAgent: request.headers.get("user-agent") || "" });
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const check = await verifyTurnstile(body.turnstileToken, ip);
  if (!check.ok) return json({ error: check.error }, 403);
  if (recentFoundingFromIp(ip, new Date(Date.now() - 3600_000).toISOString()) >= FOUNDING_PER_IP_PER_HOUR) {
    return json({ error: "Too many requests from this connection. Try again later." }, 429);
  }
  const result = await submitFounding(parsed);
  return result.ok ? json({ ok: true, duplicate: result.duplicate }) : json({ error: result.error }, result.status);
}
