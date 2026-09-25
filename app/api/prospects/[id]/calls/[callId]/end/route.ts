import { boot, json } from "@/lib/http";
import { finalizeCall } from "@/lib/prospect/pipeline";
import { callById } from "@/lib/prospect/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string; callId: string }> }) {
  boot();
  const { id, callId } = await context.params;
  const call = callById(callId);
  if (!call || call.prospect_id !== id) return json({ error: "Not found" }, 404);
  void finalizeCall(callId);
  return json({ ok: true });
}
