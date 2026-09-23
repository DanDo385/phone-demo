import { get, run } from "./db";
import { id } from "./ids";
import { addTimeline, addTurn, nowIso } from "./records";

type TranscriptTurn = {
  role?: string;
  message?: string;
  time_in_call_secs?: number;
  tool_calls?: Array<{ tool_name?: string; name?: string }>;
};

export function ingestPostCall(payload: Record<string, unknown>): { ok: boolean; duplicate?: boolean } {
  const data = (payload.data as Record<string, unknown> | undefined) ?? payload;
  const conversationId = String(data.conversation_id ?? "");
  const eventId = String(payload.event_id ?? conversationId ?? "");
  if (!eventId) return { ok: false };
  const seen = get("SELECT id FROM webhook_receipts WHERE provider = 'elevenlabs' AND event_id = ?", eventId);
  if (seen) return { ok: true, duplicate: true };
  run("INSERT INTO webhook_receipts(id, provider, event_id, received_at) VALUES(?, 'elevenlabs', ?, ?)", id("wh"), eventId, nowIso());
  const dynamic = ((data.conversation_initiation_client_data as { dynamic_variables?: Record<string, string> } | undefined)?.dynamic_variables) ?? {};
  const metadata = (data.metadata as { phone_call?: { call_sid?: string } } | undefined) ?? {};
  const callSid = metadata.phone_call?.call_sid;
  const fromCall = callSid ? get<{ inquiry_id: string }>("SELECT inquiry_id FROM calls WHERE call_sid = ?", callSid) : undefined;
  const inquiryId = dynamic.inquiry_id || fromCall?.inquiry_id;
  if (!inquiryId) return { ok: true };
  const session = get<{ id: string }>("SELECT id FROM sessions WHERE inquiry_id = ? ORDER BY started_at DESC LIMIT 1", inquiryId);
  if (!session) return { ok: true };
  if (conversationId) {
    run("UPDATE sessions SET provider_conversation_id = ? WHERE id = ?", conversationId, session.id);
  }
  const transcript = (data.transcript as TranscriptTurn[] | undefined) ?? [];
  transcript.forEach((turn) => {
    if (!turn.message) return;
    addTurn({
      inquiryId,
      sessionId: session.id,
      speaker: turn.role === "agent" ? "agent" : "caller",
      text: turn.message,
      language: dynamic.preferred_language === "es" ? "es" : "en",
      sourceKind: "post_call",
    });
    for (const tool of turn.tool_calls ?? []) {
      if ((tool.tool_name || tool.name) === "language_detection") {
        addTimeline({ inquiryId, kind: "language_tool", title: "ElevenLabs language detection", sourceKind: "post_call" });
      }
    }
  });
  run("UPDATE sessions SET status = 'completed', ended_at = ? WHERE id = ?", nowIso(), session.id);
  addTimeline({ inquiryId, kind: "post_call_transcript", title: "Post-call transcript imported", detail: conversationId, sourceKind: "post_call" });
  return { ok: true };
}

export function ingestAgentMail(payload: Record<string, unknown>): { ok: boolean; duplicate?: boolean } {
  const eventId = String(payload.event_id ?? "");
  if (!eventId) return { ok: false };
  const seen = get("SELECT id FROM webhook_receipts WHERE provider = 'agentmail' AND event_id = ?", eventId);
  if (seen) return { ok: true, duplicate: true };
  run("INSERT INTO webhook_receipts(id, provider, event_id, received_at) VALUES(?, 'agentmail', ?, ?)", id("wh"), eventId, nowIso());
  const type = String(payload.event_type ?? "");
  const message = (payload.message as Record<string, unknown> | undefined) ?? {};
  const messageId = String(message.message_id ?? "");
  const threadId = String(message.thread_id ?? "");
  if (type === "message.delivered" || type === "message.bounced" || type === "message.sent") {
    const status = type === "message.bounced" ? "bounced" : type === "message.delivered" ? "delivered" : "sent";
    if (messageId) run("UPDATE emails SET status = ? WHERE provider_message_id = ?", status, messageId);
  }
  if (type === "message.received") {
    const email = get<{ inquiry_id: string }>(
      "SELECT inquiry_id FROM emails WHERE provider_thread_id = ? OR instr(text_body, ?) > 0 LIMIT 1",
      threadId,
      threadId,
    );
    const subject = String(message.subject ?? "");
    const match = subject.match(/inq_[a-f0-9]+/i);
    const inquiryId = email?.inquiry_id || (match ? match[0] : "");
    if (!inquiryId) return { ok: true };
    const session = get<{ id: string }>("SELECT id FROM sessions WHERE inquiry_id = ? ORDER BY started_at DESC LIMIT 1", inquiryId);
    if (!session) return { ok: true };
    const text = String(message.text ?? message.preview ?? "");
    addTurn({
      inquiryId,
      sessionId: session.id,
      speaker: "caller",
      text: `Email reply (untrusted customer content): ${text.slice(0, 2000)}`,
      language: "en",
      sourceKind: "live",
    });
    addTimeline({ inquiryId, kind: "email_reply", title: "Customer email received", detail: "Treated as untrusted content", sourceKind: "live" });
  }
  return { ok: true };
}
