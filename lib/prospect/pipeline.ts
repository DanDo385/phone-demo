import Anthropic from "@anthropic-ai/sdk";
import { agentMailReady } from "../providers/status";
import { analyzeProspect } from "./analyze";
import { sendReportEmail, sendTranscriptEmail } from "./emails";
import {
  analysisOf,
  callById,
  failProspect,
  linesFor,
  markCallEnded,
  prospectById,
  replaceLines,
  saveAnalysis,
  saveCallSummary,
  saveSources,
  setReportEmailStatus,
  setStage,
  staleLiveCalls,
} from "./store";
import { lookupPlace, scrapeWebsite } from "./sources";
import { finalTranscript, saveRecording } from "./conversation";

const SUMMARY_MODEL = process.env.PROSPECT_SUMMARY_MODEL || "claude-opus-5";

// Runs in the background after the intake form posts. Stages drive the progress UI.
export async function runAnalysis(prospectId: string): Promise<void> {
  const prospect = prospectById(prospectId);
  if (!prospect) return;
  try {
    setStage(prospectId, "reading_website");
    const sitePromise = scrapeWebsite(prospect.website);
    setStage(prospectId, "reading_profile");
    const [site, place] = await Promise.all([sitePromise, lookupPlace(prospect.gbp_input || "", prospect.website)]);
    saveSources(prospectId, site, place);
    if (!site.ok && !place.found) {
      failProspect(prospectId, `We could not read the website or find a Google Business Profile. ${site.error ?? ""}`.trim());
      return;
    }
    setStage(prospectId, "writing_script");
    const analysis = await analyzeProspect({ website: prospect.website, site, place });
    saveAnalysis(prospectId, analysis);
    if (agentMailReady()) {
      const sent = await sendReportEmail(prospectById(prospectId)!, analysis);
      setReportEmailStatus(prospectId, sent.status === "sent" ? "sent" : `failed: ${sent.error ?? "unknown"}`);
    } else {
      setReportEmailStatus(prospectId, "not configured");
    }
  } catch (error) {
    console.error("prospect analysis failed", error);
    failProspect(prospectId, error instanceof Error ? error.message : "Analysis failed");
  }
}

async function summarize(businessName: string, transcript: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: `Summarize a phone call between a caller and the AI receptionist for ${businessName}, for the business owner. Three to five short lines: who called and why, what was answered or booked (with the time), and any follow-up the owner should do. Refer to the caller by name or as "the caller"; do not assume gender. Plain text, no markdown, no title or heading line.`,
    messages: [{ role: "user", content: transcript }],
  });
  if (response.stop_reason === "refusal") return "Summary unavailable.";
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

const finalizing = new Set<string>();

// Idempotent. Triggered by the Twilio status callback, the browser hanging up, or the idle sweep.
export async function finalizeCall(callId: string): Promise<void> {
  if (finalizing.has(callId)) return;
  finalizing.add(callId);
  try {
    markCallEnded(callId);
    const call = callById(callId);
    if (!call || call.status === "summarized") return;
    const prospect = prospectById(call.prospect_id);
    const analysis = analysisOf(prospect);
    // Prefer ElevenLabs' final transcript (it has timings and no discarded turns), and keep the audio.
    if (call.conversation_id) {
      const official = await finalTranscript(call.conversation_id);
      if (official) replaceLines(callId, official);
      // Audio is ready once the transcript is; a failure only means no playback.
      await saveRecording(callId, call.conversation_id).catch(() => false);
    }
    const lines = linesFor(callId);
    if (!prospect || !analysis || lines.filter((l) => l.speaker === "caller").length === 0) {
      saveCallSummary(callId, "The call ended before the caller said anything.", "skipped");
      return;
    }
    const transcript = lines.map((l) => `${l.speaker === "agent" ? "Receptionist" : "Caller"}: ${l.text}`).join("\n");
    const summary = await summarize(analysis.business.name, transcript).catch(() => "Summary unavailable.");
    let emailStatus = "not configured";
    if (agentMailReady()) {
      const sent = await sendTranscriptEmail(prospect, analysis, summary, lines);
      emailStatus = sent.status === "sent" ? "sent" : `failed: ${sent.error ?? "unknown"}`;
    }
    saveCallSummary(callId, summary, emailStatus);
  } finally {
    finalizing.delete(callId);
  }
}

// Browser tabs close without telling anyone; phone calls may miss a status callback.
export async function sweepIdleCalls(idleMs = 90_000): Promise<void> {
  for (const call of staleLiveCalls(idleMs)) await finalizeCall(call.id);
}
