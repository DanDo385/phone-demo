import crypto from "node:crypto";

// Which engine answers prospect phone calls: ElevenLabs (default) or the self-hosted
// Pipecat service in voice/. The self-hosted stream is public, so each TwiML carries a
// token the voice server checks before spending any STT, LLM or TTS credit.

export function selfHostedVoice(): { url: string } | null {
  const url = process.env.VOICE_STREAM_URL;
  if (process.env.PROSPECT_VOICE_ENGINE !== "selfhosted" || !url || !process.env.LLM_RELAY_SECRET) return null;
  return { url };
}

// Covers the greeting too: the voice server speaks it without asking the app, so it must
// not be alterable in transit.
export function streamToken(prospectId: string, callSid: string, greeting: string): string {
  return crypto.createHmac("sha256", process.env.LLM_RELAY_SECRET || "").update(`${prospectId}:${callSid}:${greeting}`).digest("hex");
}

// Asks the voice server to render and cache a prospect's greeting now, so the first
// ring does not wait ~1 s for it. Best effort.
export async function prewarmGreeting(greeting: string): Promise<void> {
  const voice = selfHostedVoice();
  if (!voice) return;
  const url = voice.url.replace(/^ws/, "http").replace(/\/twilio$/, "/prewarm");
  await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.LLM_RELAY_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: greeting }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => undefined);
}

function attr(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch] ?? ch);
}

export function selfHostedTwiml(input: { url: string; prospectId: string; callSid: string; from: string; greeting: string }): string {
  const params = {
    prospect_id: input.prospectId,
    call_sid: input.callSid,
    from: input.from,
    greeting: input.greeting,
    token: streamToken(input.prospectId, input.callSid, input.greeting),
  };
  const tags = Object.entries(params)
    .map(([name, value]) => `<Parameter name="${name}" value="${attr(value)}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${attr(input.url)}">${tags}</Stream></Connect></Response>`;
}
