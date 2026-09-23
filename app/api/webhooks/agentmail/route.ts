import { boot, json } from "@/lib/http";
import { ingestAgentMail } from "@/lib/ingest";
import { verifySvixSignature } from "@/lib/webhooks";

export async function POST(request: Request) {
  boot();
  const raw = await request.text();
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook secret is not configured" }, 403);
  const ok = verifySvixSignature({
    secret,
    rawBody: raw,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  });
  if (!ok) return json({ error: "Invalid signature" }, 401);
  return json(ingestAgentMail(JSON.parse(raw) as Record<string, unknown>));
}
