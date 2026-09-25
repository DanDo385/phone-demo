import { get } from "@/lib/db";
import { boot, json } from "@/lib/http";
import { isSelfHosted, storeRecording } from "@/lib/prospect/conversation";
import { finalizeCall } from "@/lib/prospect/pipeline";
import { replaceLines, type Line } from "@/lib/prospect/store";

// The self-hosted voice service posts here when a call ends: the timed transcript it
// observed and a WAV recording (caller left, agent right). Same secret as the relay.
export async function POST(request: Request) {
  boot();
  const secret = process.env.LLM_RELAY_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);
  const form = await request.formData().catch(() => null);
  const meta = JSON.parse(String(form?.get("meta") || "{}")) as { conversation_id?: string; call_sid?: string; lines?: Line[] };
  if (!meta.conversation_id || !isSelfHosted(meta.conversation_id)) return json({ error: "conversation_id is required" }, 400);
  const call =
    get<{ id: string }>("SELECT id FROM prospect_calls WHERE conversation_id = ?", meta.conversation_id) ??
    (meta.call_sid ? get<{ id: string }>("SELECT id FROM prospect_calls WHERE call_sid = ?", meta.call_sid) : undefined);
  if (!call) return json({ error: "Unknown call" }, 404);
  const lines = (meta.lines ?? []).filter((l) => (l.speaker === "agent" || l.speaker === "caller") && l.text?.trim());
  if (lines.length) replaceLines(call.id, lines);
  const audio = form?.get("audio");
  if (audio instanceof Blob && audio.size > 44) storeRecording(call.id, Buffer.from(await audio.arrayBuffer()), "wav");
  await finalizeCall(call.id);
  return json({ ok: true, callId: call.id, lines: lines.length });
}
