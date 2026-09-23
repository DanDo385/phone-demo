import { elevenConfigured } from "./status";

export async function signedUrl(agentId: string): Promise<{ ok: true; signedUrl: string } | { ok: false; error: string }> {
  if (!elevenConfigured()) return { ok: false, error: "ElevenLabs is not configured" };
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } },
  );
  const body = (await response.json().catch(() => ({}))) as { signed_url?: string };
  if (!response.ok || !body.signed_url) return { ok: false, error: `ElevenLabs signed URL returned ${response.status}` };
  return { ok: true, signedUrl: body.signed_url };
}

export async function registerTwilioCall(input: {
  from: string;
  to: string;
  inquiryId: string;
  language: string;
}): Promise<{ ok: true; twiml: string } | { ok: false; error: string }> {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_AGENT_ID) {
    return { ok: false, error: "ElevenLabs agent is not configured" };
  }
  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/register-call", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: process.env.ELEVENLABS_AGENT_ID,
      from_number: input.from,
      to_number: input.to,
      direction: "inbound",
      conversation_initiation_client_data: {
        dynamic_variables: {
          inquiry_id: input.inquiryId,
          preferred_language: input.language,
        },
      },
    }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: `ElevenLabs register-call returned ${response.status}` };
  return { ok: true, twiml: text };
}

export async function synthesizePreview(voiceId: string, text: string): Promise<{ ok: true; audio: Buffer } | { ok: false; error: string }> {
  if (!process.env.ELEVENLABS_API_KEY) return { ok: false, error: "ElevenLabs is not configured" };
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5" }),
  });
  if (!response.ok) return { ok: false, error: `Speech synthesis returned ${response.status}` };
  return { ok: true, audio: Buffer.from(await response.arrayBuffer()) };
}
