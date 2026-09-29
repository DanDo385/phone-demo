import { demoLineOwned } from "./demoLine";
import { mockSlots } from "./calendar";
import { hasRecording } from "./conversation";
import { analysisOf, bookingsFor, callsFor, linesFor, prospectById, sourcesOf } from "./store";

function displayNumber(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

// Everything the prospect page renders, in one payload. No secrets, no raw scrape text.
export function prospectView(pid: string) {
  const row = prospectById(pid);
  if (!row) return null;
  const analysis = analysisOf(row);
  const sources = sourcesOf(row);
  const demoNumber = demoLineOwned() ?? "";
  const phoneReady = Boolean(demoNumber && process.env.ELEVENLABS_PROSPECT_AGENT_ID);
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    error: row.error,
    website: row.website,
    reportEmail: row.report_email_status,
    emailMasked: row.email.replace(/^(.).*(@.*)$/, "$1•••$2"),
    callerMatched: Boolean(row.phone_e164),
    demoLine: phoneReady ? { e164: demoNumber, display: displayNumber(demoNumber) } : null,
    browserCall: Boolean(process.env.ELEVENLABS_PROSPECT_AGENT_ID && process.env.ELEVENLABS_API_KEY),
    sources: sources
      ? {
          site: { ok: sources.site.ok, error: sources.site.error, pages: sources.site.pages.map((p) => ({ url: p.url, title: p.title })) },
          place: { ...sources.place, reviews: undefined },
        }
      : null,
    analysis,
    calendar: analysis ? mockSlots(row.id, analysis) : [],
    bookings: bookingsFor(row.id),
    calls: callsFor(row.id).map((call) => ({
      id: call.id,
      channel: call.channel,
      status: call.status,
      summary: call.summary,
      emailStatus: call.email_status,
      startedAt: call.started_at,
      endedAt: call.ended_at,
      recording: call.status === "summarized" && hasRecording(call.id) ? `/api/prospects/${row.id}/calls/${call.id}/audio` : null,
      lines: linesFor(call.id).map((l) => ({ seq: l.seq, speaker: l.speaker, text: l.text, atSecs: l.at_secs, at: l.created_at })),
    })),
  };
}

export type ProspectView = NonNullable<ReturnType<typeof prospectView>>;
