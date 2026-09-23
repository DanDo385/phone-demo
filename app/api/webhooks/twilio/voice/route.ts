import { boot } from "@/lib/http";
import { handleInbound } from "@/lib/twilioFlow";
import { verifyTwilioSignature } from "@/lib/webhooks";

export async function POST(request: Request) {
  boot();
  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  if (!authorized(request, params)) return new Response("Invalid signature", { status: 403 });
  const twiml = await handleInbound(params);
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

function authorized(request: Request, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return process.env.TWILIO_ALLOW_UNSIGNED === "true";
  const url = `${(process.env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, "")}${new URL(request.url).pathname}`;
  return verifyTwilioSignature({ authToken: token, url, params, signature: request.headers.get("x-twilio-signature") });
}
