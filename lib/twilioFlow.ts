import { get, run } from "./db";
import { registerTwilioCall } from "./providers/elevenlabs";
import { addTimeline, createInquiry, nowIso } from "./records";
import { initialState } from "./dialogue";
import { sameNumber, toE164 } from "./phone";
import { analysisOf, openCall, prospectForCaller } from "./prospect/store";

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch] ?? ch);
}

export function twimlMessage(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xml(message)}</Say></Response>`;
}

export async function handleInbound(params: Record<string, string>): Promise<string> {
  const callSid = params.CallSid || "";
  const from = params.From || "";
  const to = params.To || "";
  const existing = get<{ forwarded: number; status: string }>("SELECT forwarded, status FROM calls WHERE call_sid = ?", callSid);
  if (existing?.forwarded) return twimlMessage("This call was already forwarded.");
  if (sameNumber(from, process.env.TWILIO_PHONE_NUMBER)) {
    return twimlMessage("Forwarding loop prevented.");
  }
  if (process.env.ELEVENLABS_PROSPECT_AGENT_ID) return connectProspect(callSid, from, to);
  const stamp = nowIso();
  if (!existing) {
    run(
      "INSERT INTO calls(call_sid, from_number, to_number, status, forwarded, created_at, updated_at) VALUES(?, ?, ?, 'ringing-owner', 0, ?, ?)",
      callSid,
      from,
      to,
      stamp,
      stamp,
    );
  }
  const owner = toE164(process.env.OWNER_FORWARD_NUMBER);
  if (!owner) return connectAgent(callSid, from, to, "direct");
  const action = `${process.env.APP_BASE_URL || ""}/api/webhooks/twilio/dial-result`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="12" action="${xml(action)}" method="POST" answerOnBridge="true"><Number>${xml(owner)}</Number></Dial></Response>`;
}

export async function handleDialResult(params: Record<string, string>): Promise<string> {
  const status = params.DialCallStatus || params.CallStatus || "";
  const callSid = params.CallSid || "";
  run("UPDATE calls SET dial_status = ?, updated_at = ? WHERE call_sid = ?", status, nowIso(), callSid);
  if (status === "completed" || status === "answered") {
    run("UPDATE calls SET status = 'owner-answered', updated_at = ? WHERE call_sid = ?", nowIso(), callSid);
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
  }
  if (!["no-answer", "busy", "failed", "canceled"].includes(status)) {
    return twimlMessage("The call ended before it could be forwarded.");
  }
  return connectAgent(callSid, params.From || "", params.To || "", status);
}

async function connectAgent(callSid: string, from: string, to: string, dialStatus: string): Promise<string> {
  const already = get<{ forwarded: number }>("SELECT forwarded FROM calls WHERE call_sid = ?", callSid);
  if (already?.forwarded) return twimlMessage("This call was already forwarded.");
  const state = initialState("auto");
  const created = createInquiry({
    origin: "telephone",
    language: state.language,
    lock: state.lock,
    channel: "telephone",
    provider: "twilio",
    sourceKind: "live",
  });
  run(
    "INSERT INTO calls(call_sid, inquiry_id, from_number, to_number, status, forwarded, dial_status, created_at, updated_at) VALUES(?, ?, ?, ?, 'forwarding', 1, ?, ?, ?) ON CONFLICT(call_sid) DO UPDATE SET inquiry_id = excluded.inquiry_id, forwarded = 1, status = 'forwarding', dial_status = excluded.dial_status, updated_at = excluded.updated_at",
    callSid,
    created.inquiryId,
    from,
    to,
    dialStatus,
    nowIso(),
    nowIso(),
  );
  addTimeline({
    inquiryId: created.inquiryId,
    kind: dialStatus === "direct" ? "direct_to_agent" : "forwarded",
    title: dialStatus === "direct" ? "Direct to AI receptionist" : "Forwarded after the owner did not answer",
    detail: dialStatus,
    sourceKind: "live",
  });
  const registered = await registerTwilioCall({ from, to, inquiryId: created.inquiryId, language: "en" });
  if (!registered.ok) {
    addTimeline({ inquiryId: created.inquiryId, kind: "forward_failed", title: "AI connection failed", detail: registered.error, sourceKind: "live" });
    return twimlMessage("The AI receptionist is not connected right now. Please call back during business hours.");
  }
  return registered.twiml;
}

// Prospect demo line: answer as the business the caller built a demo for.
async function connectProspect(callSid: string, from: string, to: string): Promise<string> {
  const prospect = prospectForCaller(toE164(from));
  const analysis = analysisOf(prospect);
  if (!prospect || !analysis) {
    return twimlMessage("Thanks for calling the AI receptionist demo. To hear it answer as your business, enter your website on the demo page first, then call back.");
  }
  // Twilio retries webhooks; one call row per CallSid.
  if (!get("SELECT id FROM prospect_calls WHERE call_sid = ?", callSid)) openCall({ prospectId: prospect.id, channel: "phone", callSid });
  const registered = await registerTwilioCall({
    from,
    to,
    agentId: process.env.ELEVENLABS_PROSPECT_AGENT_ID,
    dynamicVariables: { prospect_id: prospect.id, business_name: analysis.business.name, first_message: analysis.voice.first_message },
  });
  if (!registered.ok) return twimlMessage("The demo receptionist is not available right now. Please try again in a minute.");
  return registered.twiml;
}
