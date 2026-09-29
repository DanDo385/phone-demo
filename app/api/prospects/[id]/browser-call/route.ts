import { boot, json } from "@/lib/http";
import { signedUrl } from "@/lib/providers/elevenlabs";
import { analysisOf, openCall, prospectById } from "@/lib/prospect/store";

// Starts a browser call with the prospect agent. The page passes these dynamic
// variables to startSession; the relay and tools read them back.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  boot();
  const prospect = prospectById((await context.params).id);
  const analysis = analysisOf(prospect);
  const agentId = process.env.ELEVENLABS_PROSPECT_AGENT_ID;
  if (!prospect || !analysis) return json({ error: "The demo is not ready yet." }, 409);
  if (!agentId) return json({ error: "The demo receptionist is not configured." }, 503);
  const signed = await signedUrl(agentId);
  if (!signed.ok) return json({ error: signed.error }, 502);
  const callId = openCall({ prospectId: prospect.id, channel: "browser" });
  return json({
    callId,
    signedUrl: signed.signedUrl,
    dynamicVariables: { prospect_id: prospect.id, business_name: analysis.business.name, first_message: analysis.voice.first_message },
  });
}
