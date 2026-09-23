import { boot } from "@/lib/http";
import { handleDialResult } from "@/lib/twilioFlow";
import { verifyTwilioSignature } from "@/lib/webhooks";

export async function POST(request: Request) {
  boot();
  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token) {
    const url = `${(process.env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, "")}${new URL(request.url).pathname}`;
    if (!verifyTwilioSignature({ authToken: token, url, params, signature: request.headers.get("x-twilio-signature") })) {
      return new Response("Invalid signature", { status: 403 });
    }
  } else if (process.env.TWILIO_ALLOW_UNSIGNED !== "true") {
    return new Response("Twilio is not configured", { status: 403 });
  }
  const twiml = await handleDialResult(params);
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
