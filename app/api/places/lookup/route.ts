import { boot, clientIp, json } from "@/lib/http";
import { GRANT_COOKIE, cookieValue, readGrant, rememberGrantPlaces } from "@/lib/prospect/grants";
import { hourAgo, lookupLimitPerHour, placeLimitPerHour } from "@/lib/prospect/limits";
import { resolvePlaceTarget } from "@/lib/prospect/mapsLink";
import { matchBusiness } from "@/lib/prospect/places";
import { recentPlaceLookups, recordPlaceLookup } from "@/lib/prospect/store";

// Paid lookup. Turnstile is consumed when the grant cookie is issued. The response is the
// confirm card; it is not written to the database.
export async function POST(request: Request) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "New demos are paused right now. Try again later." }, 503);
  const ip = clientIp(request);
  const grantId = cookieValue(request.headers.get("cookie"), GRANT_COOKIE);
  const grant = readGrant(grantId, ip);
  if (!grant) return json({ error: "Complete the verification, then search again." }, 403);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const placeId = String(body.placeId || "").trim();
  const gbp = String(body.gbp || "").trim().slice(0, 500);
  const website = String(body.website || "").trim().slice(0, 300);
  const sessionToken = String(body.sessionToken || "").trim();
  if (!placeId && !gbp) return json({ error: "Enter a business name or a Google Maps link." }, 400);
  if (recentPlaceLookups({ ip, kind: "lookup" }, hourAgo()) >= lookupLimitPerHour()) {
    return json({ error: "You've looked up several businesses this hour. Try again later." }, 429);
  }
  let knownPlaceId = placeId;
  if (!knownPlaceId && /^https?:\/\//i.test(gbp)) {
    try {
      knownPlaceId = (await resolvePlaceTarget(gbp)).placeId || "";
    } catch {
      return json({ error: "That link could not be opened." }, 400);
    }
  }
  if (knownPlaceId && recentPlaceLookups({ placeId: knownPlaceId, kind: "lookup" }, hourAgo()) >= placeLimitPerHour()) {
    return json({ error: "That business was looked up several times this hour. Try again later." }, 429);
  }
  const match = await matchBusiness({ placeId: placeId || undefined, gbp, website, sessionToken: sessionToken || undefined });
  if ("error" in match) {
    recordPlaceLookup(ip, knownPlaceId || null, "lookup");
    return json({ error: match.error }, 404);
  }
  if (recentPlaceLookups({ placeId: match.primary.placeId, kind: "lookup" }, hourAgo()) >= placeLimitPerHour()) {
    recordPlaceLookup(ip, match.primary.placeId, "lookup");
    return json({ error: "That business was looked up several times this hour. Try again later." }, 429);
  }
  recordPlaceLookup(ip, match.primary.placeId, "lookup");
  rememberGrantPlaces(grantId, [match.primary.placeId, ...match.alternates.map((card) => card.placeId)]);
  return json({ primary: match.primary, alternates: match.alternates, via: match.via });
}
