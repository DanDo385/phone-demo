import { boot, json } from "@/lib/http";
import { toE164 } from "@/lib/phone";
import { runAnalysis } from "@/lib/prospect/pipeline";
import { normalizeUrl } from "@/lib/prospect/sources";
import { createProspect, recentAnalysesFromIp } from "@/lib/prospect/store";

// Public intake. Each analysis spends Firecrawl, Places and Claude credits, so cap it per visitor.
const PER_IP_PER_HOUR = Number(process.env.PROSPECT_LIMIT_PER_HOUR || 3);

export async function POST(request: Request) {
  boot();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const website = normalizeUrl(String(body.website || ""));
  const email = String(body.email || "").trim().toLowerCase();
  const phone = toE164(String(body.phone || ""));
  const gbp = String(body.gbp || "").trim().slice(0, 500);
  if (!website) return json({ error: "Enter your website address." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (body.phone && !/^\+\d{10,15}$/.test(phone)) return json({ error: "Enter the mobile number you will call from." }, 400);
  const ip = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (recentAnalysesFromIp(ip, new Date(Date.now() - 3600_000).toISOString()) >= PER_IP_PER_HOUR) {
    return json({ error: "You've built several demos this hour. Try again later." }, 429);
  }
  const id = createProspect({ website, gbpInput: gbp, email, phone, ip });
  void runAnalysis(id);
  return json({ id });
}
