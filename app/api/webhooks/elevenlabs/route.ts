import { boot, json } from "@/lib/http";
import { ingestPostCall } from "@/lib/ingest";
import { verifyElevenLabsSignature } from "@/lib/webhooks";

export async function POST(request: Request) {
  boot();
  const raw = await request.text();
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook secret is not configured" }, 403);
  if (!verifyElevenLabsSignature({ secret, rawBody: raw, header: request.headers.get("elevenlabs-signature") })) {
    return json({ error: "Invalid signature" }, 401);
  }
  const payload = JSON.parse(raw) as Record<string, unknown>;
  if (payload.type && payload.type !== "post_call_transcription") return json({ ok: true, ignored: payload.type });
  return json(ingestPostCall(payload));
}
