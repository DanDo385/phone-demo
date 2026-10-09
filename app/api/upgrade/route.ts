import { GOALS, TRADES } from "@/content/marketing/trades";
import { boot, clientIp, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientHash, createUpgrade, executeUpgrade, recentUpgrades, UPGRADE_PER_HOUR, upgradeView } from "@/lib/upgrade/store";

export async function POST(request: Request) {
  boot();
  if (process.env.DEMO_KILL_SWITCH === "true") return json({ error: "Assessments are paused right now." }, 503);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseUpgrade(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const ip = clientIp(request);
  const check = await verifyTurnstile(body.turnstileToken, ip);
  if (!check.ok) return json({ error: check.error }, 403);
  const hash = clientHash(ip);
  if (recentUpgrades(hash, new Date(Date.now() - 3600_000).toISOString()) >= UPGRADE_PER_HOUR) {
    return json({ error: "Too many assessments from this connection. Try again later." }, 429);
  }
  const created = createUpgrade({ ...parsed, clientHash: hash });
  const row = await executeUpgrade(created.id);
  return json({ id: row.id, status: upgradeView(row).status });
}

function parseUpgrade(body: Record<string, unknown>): { websiteUrl: string; mapsUrl: string | null; businessName: string | null; industry: string | null; goals: string[]; idempotencyKey: string } | { error: string } {
  const websiteUrl = httpUrl(body.websiteUrl);
  if (!websiteUrl) return { error: "Enter a public website address that starts with https://." };
  const mapsRaw = typeof body.mapsUrl === "string" ? body.mapsUrl.trim() : "";
  const mapsUrl = mapsRaw ? httpUrl(mapsRaw) : null;
  if (mapsRaw && !mapsUrl) return { error: "The profile link needs to be an http or https address." };
  const industry = typeof body.industry === "string" ? body.industry.trim() : "";
  if (industry && !TRADES.some((trade) => trade.value === industry)) return { error: "Choose an industry from the list." };
  const goals = Array.isArray(body.goals) ? body.goals.filter((goal): goal is string => typeof goal === "string" && GOALS.some((item) => item.value === goal)) : [];
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (idempotencyKey.length < 16) return { error: "Refresh the page and try again." };
  const businessName = typeof body.businessName === "string" ? body.businessName.trim().slice(0, 160) : "";
  return { websiteUrl, mapsUrl, businessName: businessName || null, industry: industry || null, goals, idempotencyKey };
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
