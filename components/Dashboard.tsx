"use client";

import { useEffect, useRef, useState } from "react";
import { OWNER, TECHNICIANS, serviceByCode } from "@/lib/business";
import { formatMoney } from "@/lib/money";
import { demoClockLabel, formatDashboard } from "@/lib/time";

type View = {
  inquiry: Record<string, unknown>;
  customer: Record<string, unknown> | null;
  turns: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  languages: Array<Record<string, unknown>>;
  emails: Array<Record<string, unknown>>;
  appointments: Array<Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  invoice: Record<string, unknown> | null;
  lines: Array<Record<string, unknown>>;
  review: Record<string, unknown> | null;
  jobs: Array<Record<string, unknown>>;
  stages: Array<{ id: number; key: string; title: string; status: string; detail: string; branch?: boolean }>;
  demoOffsetMs: number;
  mode: string;
  modeNote: string | null;
  sessions: Array<Record<string, unknown>>;
};

export function Dashboard({ inquiryId }: { inquiryId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seenTurns = useRef(0);

  async function load() {
    const response = await fetch(`/api/inquiries/${inquiryId}`);
    if (!response.ok) {
      setError("The inquiry could not be loaded.");
      return;
    }
    setError("");
    setView(await response.json());
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [inquiryId]);

  useEffect(() => {
    const count = view?.turns.length ?? 0;
    if (count > seenTurns.current) endRef.current?.scrollIntoView({ block: "nearest" });
    seenTurns.current = count;
  }, [view?.turns.length]);

  async function act(url: string, body?: unknown) {
    setBusy(true);
    setNotice("");
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; note?: string; already?: boolean };
    setBusy(false);
    if (!response.ok) {
      setNotice(payload.error || "That action did not complete.");
      return;
    }
    if (payload.already) setNotice("Demo invoice already exists. No payment was posted.");
    else if (payload.note) setNotice(payload.note);
    else if (url.endsWith("/complete")) setNotice("Demo invoice recorded. No payment was posted.");
    await load();
  }

  if (!view && error) {
    return (
      <main className="lobby">
        <p>{error}</p>
        <button className="btn" onClick={() => { setError(""); void load(); }}>Try again</button>
      </main>
    );
  }
  if (!view) return <p className="lobby">Loading the inquiry…</p>;

  const facts = JSON.parse(String(view.inquiry.facts_json || "{}")) as Record<string, string>;
  const lang = view.inquiry.preferred_language === "es" ? "es" : "en";
  const service = serviceByCode(facts.serviceCode);
  const failedTools = view.tools.filter((tool) => tool.status === "failed").length;
  const next = nextStep(view, emailOpen);

  return (
    <div>
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo · Owner dashboard</div>
          <div className="wordmark" style={{ fontSize: 28 }}>Palmetto Coast</div>
          <div className="muted">{OWNER.name} · {String(view.inquiry.id)}</div>
        </div>
        <div className="actions">
          <span className={`src ${view.mode}`}>{labelMode(view.mode)}</span>
          <button className="btn-secondary" onClick={() => setShowTranslation((value) => !value)}>
            {showTranslation ? "Hide English translation" : "Show English translation"}
          </button>
          {next.kind === "email" && (
            <button className="btn" disabled={busy} onClick={() => { setEmailOpen(true); document.getElementById("continuation-email")?.scrollIntoView({ block: "center" }); }}>{next.label}</button>
          )}
          {next.kind === "complete" && (
            <button className="btn" disabled={busy} onClick={() => act(`/api/owner/inquiries/${inquiryId}/complete`)}>{next.label}</button>
          )}
          {next.kind === "clock" && (
            <button className="btn" disabled={busy} onClick={() => act(`/api/owner/clock`, { inquiryId, mode: "reminder" })}>{next.label}</button>
          )}
          {reminderWaiting(view) && (
            <button className="btn-quiet" disabled={busy} onClick={() => act(`/api/owner/inquiries/${inquiryId}/reminder`, { action: "cancel" })}>Cancel the unsent reminder</button>
          )}
        </div>
      </header>
      <div className="banner">{demoClockLabel(view.demoOffsetMs)}</div>
      {view.modeNote && <div className="banner">{view.modeNote}</div>}
      {notice && <div className="banner">{notice}</div>}
      {error && <div className="banner">{error}</div>}
      <main className="shell">
        <section className="panel">
          <h2>Customer journey</h2>
          <p className="next-line"><b>Next.</b> {next.hint}</p>
          <div className="journey">
            {view.stages.map((stage) => (
              <article key={stage.id} className={`stage ${stage.status} ${stage.branch ? "branch" : ""}`}>
                <div className="num">{stage.id}</div>
                <div>
                  <div className="stage-title">{stage.title}</div>
                  <span className={`pill ${stage.status}`}>{stage.status.replaceAll("_", " ")}</span>
                  {stage.detail ? <div className="stage-detail">{stage.detail}</div> : null}
                </div>
              </article>
            ))}
          </div>
          <p className="muted">The branching stage stays on this same inquiry. Sending the continuation email does not end the call or block the booking.</p>
        </section>
        <section className="panel">
          <h2>Conversation</h2>
          <p className="muted">
            {view.turns.length} turns · {view.tools.length} tool calls · {failedTools} failed
          </p>
          <p className="muted">
            Language {String(view.inquiry.preferred_language)} · {view.sessions[0] ? String(view.sessions[0].channel) : "no session"} ·{" "}
            {view.sessions.some((session) => session.channel === "replay" || session.source_kind === "simulated_replay")
              ? "Telephone forwarding in this record is a simulated replay."
              : "Live telephone transcripts, when connected, are imported after the call. Call status and tool events show during the call. Owner takeover is not available."}
          </p>
          <div className="transcript">
            {view.languages.map((event) => (
              <div key={String(event.id)} className="muted">Language change: {String(event.from_language || "—")} → {String(event.to_language)} · {String(event.reason)}</div>
            ))}
            {view.turns.map((turn) => (
              <div key={String(turn.id)} className={`bubble ${turn.speaker === "agent" ? "agent" : "caller"}`}>
                <div className="meta">
                  <span>{turn.speaker === "agent" ? "AI receptionist" : "Caller"}</span>
                  <span>{String(turn.language)}</span>
                  <span>Recorded {formatDashboard(new Date(String(turn.started_at)))} Eastern</span>
                </div>
                <div>{String(turn.text)}</div>
                {showTranslation && turn.translation_text && turn.language !== "en" ? (
                  <div className="translation">Machine translation: {String(turn.translation_text)}</div>
                ) : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </section>
        <aside className="side">
          <section className="card">
            <h3>Customer</h3>
            <div className="row"><span>Name</span><b>{facts.name || "Not on file"}</b></div>
            <div className="row"><span>Phone</span><b>{facts.phone || "Not on file"}</b></div>
            <div className="row"><span>Email</span><b>{facts.email || "Not on file"}</b></div>
            <div className="row"><span>Address</span><b>{facts.address || "Not on file"}</b></div>
            <div className="row"><span>Issue</span><b>{facts.issue || String(view.inquiry.issue || "Not on file")}</b></div>
            <div className="row"><span>Service</span><b>{service ? service.name[lang] : "Not chosen yet"}</b></div>
          </section>
          <section className="card">
            <h3>Calendar {view.inquiry.calendar_revealed ? "" : "· hidden until scheduling"}</h3>
            {view.appointments.map((appt) => {
              const tech = TECHNICIANS.find((item) => item.id === appt.technician_id);
              const held = appt.google_event_id ? "Calendar event recorded · not a dispatch" : "Simulated booking · no Google event · not a dispatch";
              return (
                <div key={String(appt.id)}>
                  <div>{String(appt.summary)}</div>
                  <div className="muted">{formatDashboard(new Date(String(appt.starts_at)))} Eastern</div>
                  <div className="muted">{tech?.name || "Technician not on file"} · {held}</div>
                </div>
              );
            })}
            {view.appointments.length === 0 && <p className="muted">Not booked.</p>}
          </section>
          <section className="card">
            <h3>Email</h3>
            {view.emails.length === 0 && <p className="muted">No email yet.</p>}
            {view.emails.map((email) => {
              const open = emailOpen && email.kind === "continuation";
              const link = String(email.text_body || "").match(/https?:\/\/\S+/)?.[0];
              return (
                <details id={email.kind === "continuation" ? "continuation-email" : undefined} key={String(email.id)} className="tool" open={open || undefined}>
                  <summary>{emailSummary(email)}</summary>
                  <div className="muted">{String(email.subject)}</div>
                  {email.error ? <div className="demo-flag">{String(email.error)}</div> : null}
                  {link && email.kind === "continuation" ? <p><a href={link}>Open continuation page</a></p> : null}
                  <pre>{String(email.text_body)}</pre>
                </details>
              );
            })}
          </section>
          <section className="card">
            <h3>Tools</h3>
            {view.tools.length === 0 && <p className="muted">No tools yet.</p>}
            <div className="scroll-pane">
              {view.tools.map((tool) => {
                const failed = tool.status === "failed";
                const duplicate = String(tool.result_json || "").includes("\"duplicate\":true");
                return (
                  <details key={String(tool.id)} className="tool" open={failed || undefined}>
                    <summary>
                      {String(tool.name)} · {String(tool.status)} · {String(tool.duration_ms ?? "—")} ms
                      {failed ? <span className="pill failed"> Failed</span> : null}
                    </summary>
                    <div className="muted">{formatDashboard(new Date(String(tool.started_at)))} Eastern</div>
                    {duplicate ? <div className="demo-flag">Duplicate suppressed · not a second booking</div> : null}
                    {tool.error ? <div className="demo-flag">{String(tool.error)}</div> : null}
                    <pre>{String(tool.args_redacted_json)}</pre>
                    {tool.result_json ? <pre>{String(tool.result_json)}</pre> : null}
                  </details>
                );
              })}
            </div>
          </section>
          <section className="card">
            <h3>Attachments</h3>
            {view.attachments.length === 0 && <p className="muted">No photo yet.</p>}
            {view.attachments.map((file) => (
              <div key={String(file.id)}>
                <div className="demo-flag">{String(file.caption)}</div>
                <img alt={String(file.caption)} src={`/api/attachments/${file.id}`} style={{ width: "100%", borderRadius: 12 }} />
              </div>
            ))}
          </section>
          <section className="card">
            <h3>Invoice</h3>
            {!view.invoice && <p className="muted">No invoice yet.</p>}
            {view.invoice && (
              <div>
                <div className="demo-flag">{String(view.invoice.demo_banner)}</div>
                <div>{String(view.invoice.number)} · {String(view.invoice.status)}</div>
                {view.lines.map((line) => (
                  <div className="row" key={String(line.id)}>
                    <span>{String(lang === "es" ? line.description_es : line.description_en)}</span>
                    <b>{formatMoney(Number(line.amount_cents))}</b>
                  </div>
                ))}
                <div className="row"><span>Total USD</span><b>{formatMoney(Number(view.invoice.total_cents))}</b></div>
                <a href={`/api/invoices/${view.invoice.id}/pdf`}>Download PDF</a>
              </div>
            )}
          </section>
          <section className="card">
            <h3>Review</h3>
            <div>{reviewLabel(view)}</div>
            <div className="muted">{reminderLabel(view)}</div>
          </section>
          <section className="card">
            <h3>History</h3>
            <div className="scroll-pane">
              {view.events.map((event) => (
                <div key={String(event.id)} className="row">
                  <span>
                    {String(event.title)}
                    {event.detail ? <span className="muted"> — {String(event.detail)}</span> : null}
                    <span className="muted"> · {formatDashboard(new Date(String(event.created_at)))} Eastern</span>
                  </span>
                  <span className={`src ${event.source_kind}`}>{sourceLabel(String(event.source_kind))}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function nextStep(view: View, emailOpen: boolean): { kind: "email" | "complete" | "clock" | "done"; label: string; hint: string } {
  const reminder = view.jobs.find((job) => job.kind === "review_reminder");
  const reminderStatus = reminder ? String(reminder.status) : null;
  if (reminderStatus === "done") {
    return { kind: "done", label: "", hint: "One reminder prepared. Advancing the clock again will not send a second one." };
  }
  if (reminderStatus === "cancelled") {
    return { kind: "done", label: "", hint: "Reminder cancelled. A second one was not created." };
  }
  if (view.invoice && (reminderStatus === "pending" || reminderStatus === "running")) {
    return {
      kind: "clock",
      label: "Advance demo clock to reminder",
      hint: "Jumps the demo clock. A real 48-hour wait does not elapse.",
    };
  }
  if (view.invoice && reminderStatus === "failed") {
    return { kind: "done", label: "", hint: "The reminder failed. The clock will not create another one, and no payment was posted." };
  }
  if (view.invoice) {
    return { kind: "done", label: "", hint: "Demo invoice recorded. No reminder is waiting, and no payment was posted." };
  }
  const continuation = view.emails.find((email) => email.kind === "continuation");
  if (continuation && !emailOpen) {
    const status = String(continuation.status);
    const hint = status === "failed"
      ? "The continuation email failed. Open it to read the error. It was not delivered."
      : status === "sent" || status === "delivered"
        ? "The provider accepted the continuation email. Open it here."
        : "Open the continuation email. It is a simulated preview, not delivered. This replay may already include the fictional demo photo.";
    return { kind: "email", label: "Open continuation email", hint };
  }
  return { kind: "complete", label: "Mark demo service completed", hint: "Mark the demo service completed. This does not take payment." };
}

function reminderWaiting(view: View): boolean {
  return view.jobs.some((job) => job.kind === "review_reminder" && (job.status === "pending" || job.status === "running"));
}

function emailSummary(email: Record<string, unknown>): string {
  const kind = String(email.kind);
  const status = String(email.status);
  const name = kind === "continuation" ? "Continuation email" : kind === "confirmation" ? "Booking confirmation" : kind === "reminder" ? "Reminder" : kind === "review" ? "Review invitation" : kind;
  if (status === "simulated") return `${name} · simulated, not delivered`;
  if (status === "failed") return `${name} · failed`;
  if (status === "sent" || status === "delivered") return `${name} · provider accepted`;
  return `${name} · ${status}`;
}

function reviewLabel(view: View): string {
  if (!view.review) return "Not sent";
  const status = String(view.review.status);
  if (status === "completed_reported") return "Customer said they already reviewed · not posted";
  if (status === "opted_out") return "Opted out · not posted";
  if (status === "failed") return "Invitation failed · not posted";
  if (status === "sent" || status === "delivered") return "Invitation accepted by the provider · not posted publicly";
  if (status === "simulated") return "Invitation: simulated preview, not posted";
  return `Invitation: ${status} · not posted publicly`;
}

function reminderLabel(view: View): string {
  const job = view.jobs.find((item) => item.kind === "review_reminder");
  if (!job) return "Not scheduled";
  if (job.status === "done") return "One reminder prepared";
  if (job.status === "pending" || job.status === "running") return `Scheduled on the demo clock · ${formatDashboard(new Date(String(job.run_at)))} Eastern`;
  if (job.status === "cancelled") return "Cancelled";
  if (job.status === "failed") return "Reminder failed";
  return String(job.status);
}

function sourceLabel(kind: string): string {
  if (kind === "simulated_replay") return "Simulated replay";
  if (kind === "simulated") return "Simulated";
  if (kind === "live") return "Live provider";
  if (kind === "post_call") return "After the call";
  return kind.replaceAll("_", " ");
}

function labelMode(mode: string): string {
  if (mode === "simulated_replay") return "Simulated replay";
  if (mode === "live") return "Live";
  return "Simulated";
}
