import { appBaseUrl } from "../ids";
import { sendAgentMail } from "../providers/agentmail";
import type { Analysis } from "./schema";
import type { LineRow, ProspectRow } from "./store";

// Prospect mail goes only to the address the prospect typed on the intake form, and at
// most once per report and once per call. Nothing here accepts an arbitrary recipient.

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function page(title: string, inner: string): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#14241c">
<h2 style="margin:0 0 12px">${esc(title)}</h2>${inner}
<p style="color:#6d6458;font-size:12px;margin-top:24px">Demo generated from your public website and Google Business Profile. Details marked as filled in were invented so the demo call works.</p></div>`;
}

export async function sendReportEmail(prospect: ProspectRow, analysis: Analysis) {
  const link = `${appBaseUrl()}/try/${prospect.id}`;
  const gaps = analysis.gaps.slice(0, 8);
  const text = [
    `Your AI receptionist demo for ${analysis.business.name} is ready: ${link}`,
    "",
    "What callers and searchers can't find:",
    ...gaps.map((g) => `- [${g.severity}] ${g.title}: ${g.detail}`),
    "",
    "Suggested enhancements:",
    ...analysis.enhancements.map((e) => `- ${e.title}: ${e.detail}`),
  ].join("\n");
  const html = page(
    `Your AI receptionist demo for ${analysis.business.name}`,
    `<p><a href="${esc(link)}">Open your demo and call the receptionist</a></p>
<h3>What callers and searchers can't find</h3><ul>${gaps.map((g) => `<li><b>${esc(g.title)}</b> (${g.severity}): ${esc(g.detail)}</li>`).join("")}</ul>
<h3>Suggested enhancements</h3><ol>${analysis.enhancements.map((e) => `<li><b>${esc(e.title)}</b>: ${esc(e.detail)}</li>`).join("")}</ol>`,
  );
  return sendAgentMail({ to: prospect.email, subject: `Your AI receptionist demo: ${analysis.business.name}`, text, html, labels: ["prospect-demo", "report"] });
}

export async function sendTranscriptEmail(prospect: ProspectRow, analysis: Analysis, summary: string, lines: LineRow[]) {
  const who = (l: LineRow) => (l.speaker === "agent" ? "Receptionist" : "Caller");
  const text = [
    `Summary of your demo call with the ${analysis.business.name} AI receptionist`,
    "",
    summary,
    "",
    "Transcript:",
    ...lines.map((l) => `${who(l)}: ${l.text}`),
    "",
    `Your demo: ${appBaseUrl()}/try/${prospect.id}`,
  ].join("\n");
  const html = page(
    `Your demo call with ${analysis.business.name}`,
    `<h3>Summary</h3><p style="white-space:pre-wrap">${esc(summary)}</p>
<h3>Transcript</h3>${lines.map((l) => `<p style="margin:6px 0"><b>${who(l)}:</b> ${esc(l.text)}</p>`).join("")}
<p><a href="${esc(`${appBaseUrl()}/try/${prospect.id}`)}">Back to your demo</a></p>`,
  );
  return sendAgentMail({ to: prospect.email, subject: `Call summary: ${analysis.business.name} AI receptionist`, text, html, labels: ["prospect-demo", "transcript"] });
}
