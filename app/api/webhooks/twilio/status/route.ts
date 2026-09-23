import { run } from "@/lib/db";
import { boot } from "@/lib/http";
import { addTimeline, nowIso } from "@/lib/records";
import { get } from "@/lib/db";
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
  const callSid = params.CallSid;
  if (callSid) {
    run("UPDATE calls SET status = ?, updated_at = ? WHERE call_sid = ?", params.CallStatus || "status", nowIso(), callSid);
    const call = get<{ inquiry_id: string | null }>("SELECT inquiry_id FROM calls WHERE call_sid = ?", callSid);
    if (call?.inquiry_id) {
      addTimeline({ inquiryId: call.inquiry_id, kind: "call_status", title: `Call ${params.CallStatus || "updated"}`, sourceKind: "live" });
    }
  }
  return new Response("ok");
}
