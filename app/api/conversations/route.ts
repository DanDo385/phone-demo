import { greetingFor, initialState } from "@/lib/dialogue";
import { json, ownerGuard } from "@/lib/http";
import { signedUrl } from "@/lib/providers/elevenlabs";
import { elevenConfigured } from "@/lib/providers/status";
import { openConversation } from "@/lib/turn";
import type { LanguageMode } from "@/lib/types";

export async function POST(request: Request) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const body = await request.json();
  const mode = (body.mode || "auto") as LanguageMode;
  const channel = body.channel === "elevenlabs" ? "browser_voice" : "browser_simulated";
  if (channel === "browser_voice" && !elevenConfigured()) {
    return json({ error: "ElevenLabs is not configured. Browser voice was not started." }, 409);
  }
  const opened = openConversation({
    origin: channel === "browser_voice" ? "browser_voice" : "simulated_browser",
    mode,
    channel,
    provider: channel === "browser_voice" ? "elevenlabs" : "simulated",
    sourceKind: channel === "browser_voice" ? "live" : "simulated",
    voiceId: String(body.voice || "avery"),
  });
  const state = initialState(mode);
  const greeting = greetingFor(state);
  let url: string | null = null;
  if (channel === "browser_voice") {
    const signed = await signedUrl(process.env.ELEVENLABS_AGENT_ID!);
    if (!signed.ok) return json({ error: signed.error }, 502);
    url = signed.signedUrl;
  }
  return json({ inquiryId: opened.inquiryId, greeting: greeting.say, signedUrl: url, mode: channel === "browser_voice" ? "live" : "simulated" });
}
