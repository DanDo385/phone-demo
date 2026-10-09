import { boot, clientIp, json } from "@/lib/http";
import { GRANT_COOKIE, cookieValue, readGrant } from "@/lib/prospect/grants";
import { AUTOCOMPLETE_LIMIT, tenMinutesAgo } from "@/lib/prospect/limits";
import { autocompletePlaces } from "@/lib/prospect/places";
import { recentPlaceLookups, recordPlaceLookup } from "@/lib/prospect/store";

const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "New demos are paused right now. Try again later." }, 503);
  const ip = clientIp(request);
  if (!readGrant(cookieValue(request.headers.get("cookie"), GRANT_COOKIE), ip)) {
    return json({ error: "Complete the verification, then search again." }, 403);
  }
  const body = (await request.json().catch(() => ({}))) as { input?: unknown; sessionToken?: unknown };
  const input = String(body.input || "").trim().slice(0, 200);
  const sessionToken = String(body.sessionToken || "");
  if (input.length < 2) return json({ suggestions: [] });
  if (!SESSION.test(sessionToken)) return json({ error: "Refresh the page and try again." }, 400);
  if (recentPlaceLookups({ ip, kind: "autocomplete" }, tenMinutesAgo()) >= AUTOCOMPLETE_LIMIT) {
    return json({ error: "Too many searches. Wait a few minutes and try again." }, 429);
  }
  recordPlaceLookup(ip, null, "autocomplete");
  if (!process.env.GOOGLE_MAPS_API_KEY?.trim()) return json({ suggestions: [], configured: false });
  try {
    const suggestions = await autocompletePlaces(input, sessionToken);
    return json({ suggestions });
  } catch {
    return json({ error: "Business search didn't respond. Try the Maps link instead." }, 502);
  }
}
