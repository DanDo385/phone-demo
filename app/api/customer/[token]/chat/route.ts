import { get, run } from "@/lib/db";
import { boot, json } from "@/lib/http";
import { id } from "@/lib/ids";
import { lookupToken, nowIso } from "@/lib/records";
import { customerTurn } from "@/lib/turn";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  boot();
  const { token } = await context.params;
  const access = lookupToken(token, "continuation");
  if (!access) return json({ error: "expired" }, 401);
  const body = await request.json();
  const existing = lookupSession(access.inquiry_id);
  if (!existing) {
    run(
      "INSERT INTO sessions(id, inquiry_id, channel, provider, language, status, source_kind, started_at) VALUES(?, ?, 'continuation_chat', 'simulated', 'en', 'active', 'simulated', ?)",
      id("ses"),
      access.inquiry_id,
      nowIso(),
    );
  }
  const outcome = await customerTurn(access.inquiry_id, String(body.text || ""), "simulated");
  return json(outcome);
}

function lookupSession(inquiryId: string): boolean {
  return Boolean(get("SELECT id FROM sessions WHERE inquiry_id = ?", inquiryId));
}
