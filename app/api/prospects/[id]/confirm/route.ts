import { boot, clientIp, json } from "@/lib/http";
import { GRANT_COOKIE, cookieValue, readGrant } from "@/lib/prospect/grants";
import { parseIntake } from "@/lib/prospect/intake";
import { analysisLimitPerHour, hourAgo, placeLimitPerHour } from "@/lib/prospect/limits";
import { runAnalysis } from "@/lib/prospect/pipeline";
import { confirmProspectPlace, prospectById, recentAnalysesFromIp, recentProspectsForPlace } from "@/lib/prospect/store";

// Confirm a different business for an existing prospect, then run analysis again.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "New demos are paused right now. Try again later." }, 503);
  const { id } = await context.params;
  const row = prospectById(id);
  if (!row || row.source !== "try") return json({ error: "Not found" }, 404);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseIntake(body, { requireEmail: false });
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const ip = clientIp(request);
  const grant = readGrant(cookieValue(request.headers.get("cookie"), GRANT_COOKIE), ip);
  if (!grant || !grant.placeIds.includes(parsed.placeId)) return json({ error: "Search again, then confirm the business." }, 403);
  const since = hourAgo();
  if (recentAnalysesFromIp(ip, since, id) >= analysisLimitPerHour()) {
    return json({ error: "You've built several demos this hour. Try again later." }, 429);
  }
  if (recentProspectsForPlace(parsed.placeId, since, id) >= placeLimitPerHour()) {
    return json({ error: "That business already has a demo this hour. Try again later." }, 429);
  }
  confirmProspectPlace(id, {
    placeId: parsed.placeId,
    website: parsed.website || row.website,
    gbpInput: parsed.gbp || row.gbp_input || "",
    trade: parsed.trade || row.trade || "",
    serviceArea: parsed.serviceArea || row.service_area || "",
  });
  void runAnalysis(id);
  return json({ id });
}
