import { analyzerEmailConsent } from "@/content/consent";
import { recordConsent } from "@/lib/consents";
import { boot, clientIp, json } from "@/lib/http";
import { GRANT_COOKIE, cookieValue, readGrant } from "@/lib/prospect/grants";
import { parseIntake } from "@/lib/prospect/intake";
import { analysisLimitPerHour, hourAgo, placeLimitPerHour } from "@/lib/prospect/limits";
import { runAnalysis } from "@/lib/prospect/pipeline";
import { createProspect, prospectByIdempotency, recentAnalysesFromIp, recentProspectsForPlace } from "@/lib/prospect/store";

// Starts analysis only after the person confirms a business from the lookup grant.
export async function POST(request: Request) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "New demos are paused right now. Try again later." }, 503);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseIntake(body, { requireEmail: true });
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const ip = clientIp(request);
  const grant = readGrant(cookieValue(request.headers.get("cookie"), GRANT_COOKIE), ip);
  if (!grant || !grant.placeIds.includes(parsed.placeId)) return json({ error: "Search again, then confirm the business." }, 403);
  const duplicate = prospectByIdempotency(parsed.idempotencyKey);
  if (duplicate) return json({ id: duplicate.id, duplicate: true });
  const since = hourAgo();
  if (recentAnalysesFromIp(ip, since) >= analysisLimitPerHour()) {
    return json({ error: "You've built several demos this hour. Try again later." }, 429);
  }
  if (recentProspectsForPlace(parsed.placeId, since) >= placeLimitPerHour()) {
    return json({ error: "That business already has a demo this hour. Try again later." }, 429);
  }
  const id = createProspect({
    website: parsed.website,
    gbpInput: parsed.gbp,
    email: parsed.email,
    phone: parsed.phone,
    ip,
    placeId: parsed.placeId,
    trade: parsed.trade,
    serviceArea: parsed.serviceArea,
    idempotencyKey: parsed.idempotencyKey,
  });
  recordConsent({ prospectId: id, consent: analyzerEmailConsent, granted: true, ip, userAgent: request.headers.get("user-agent") });
  void runAnalysis(id);
  return json({ id });
}
