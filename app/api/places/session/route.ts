import { GRANT_COOKIE, cookieValue, grantCookie, issueGrant, readGrant } from "@/lib/prospect/grants";
import { boot, clientIp, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";

// One Turnstile check unlocks autocomplete and lookup for a short window.
export async function POST(request: Request) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "New demos are paused right now. Try again later." }, 503);
  const ip = clientIp(request);
  const existing = readGrant(cookieValue(request.headers.get("cookie"), GRANT_COOKIE), ip);
  if (existing) return json({ ok: true });
  const body = (await request.json().catch(() => ({}))) as { turnstileToken?: unknown };
  const check = await verifyTurnstile(body.turnstileToken, ip);
  if (!check.ok) return json({ error: check.error }, 403);
  const grantId = issueGrant(ip);
  const response = json({ ok: true });
  response.headers.set("Set-Cookie", grantCookie(grantId));
  return response;
}
