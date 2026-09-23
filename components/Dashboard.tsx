"use client";

import { useEffect, useState } from "react";

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
  sessions: Array<Record<string, unknown>>;
};

export function Dashboard({ inquiryId }: { inquiryId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/inquiries/${inquiryId}`);
    if (!response.ok) {
      setError("The inquiry could not be loaded.");
      return;
    }
    setView(await response.json());
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [inquiryId]);

  if (!view) return <p className="lobby">Loading the inquiry…</p>;
  const facts = JSON.parse(String(view.inquiry.facts_json || "{}")) as Record<string, string>;
  const accelerated = view.demoOffsetMs > 60_000;

  return (
    <div>
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo · Owner dashboard</div>
          <div className="wordmark" style={{ fontSize: 28 }}>Palmetto Coast</div>
          <div className="muted">Alex Rivera · {String(view.inquiry.id)}</div>
        </div>
        <div className="actions">
          <span className={`src ${view.mode}`}>{labelMode(view.mode)}</span>
          <button className="btn-secondary" onClick={() => setShowTranslation((v) => !v)}>
            {showTranslation ? "Hide English translation" : "Show English translation"}
          </button>
          <button className="btn" onClick={() => act(`/api/owner/inquiries/${inquiryId}/complete`)}>Mark demo service completed</button>
          <button className="btn-secondary" onClick={() => act(`/api/owner/clock`, { inquiryId, mode: "reminder" })}>Advance demo clock to reminder</button>
          <button className="btn-quiet" onClick={() => act(`/api/owner/inquiries/${inquiryId}/reminder`, { action: "cancel" })}>Cancel reminder</button>
        </div>
      </header>
      {accelerated && (
        <div className="banner">Demo clock accelerated by {Math.round(view.demoOffsetMs / 3600000)} hours. A real 48-hour wait did not elapse.</div>
      )}
      {error && <div className="banner">{error}</div>}
      <main className="shell">
        <section className="panel">
          <h2>Customer journey</h2>
          <div className="journey">
            {view.stages.map((stage) => (
              <article key={stage.id} className={`stage ${stage.status} ${stage.branch ? "branch" : ""}`}>
                <div className="num">{stage.id}</div>
                <div>
                  <div className="stage-title">{stage.title}</div>
                  <span className={`pill ${stage.status}`}>{stage.status.replace("_", " ")}</span>
                  <div className="stage-detail">{stage.detail}</div>
                </div>
              </article>
            ))}
          </div>
          <p className="muted">Stage 2 branches from the call. Sending the email does not end the call or block the booking.</p>
        </section>
        <section className="panel">
          <h2>Conversation</h2>
          <p className="muted">
            Language {String(view.inquiry.preferred_language)} · {view.sessions[0] ? String(view.sessions[0].channel) : "no session"} ·{" "}
            {view.sessions.some((s) => s.channel === "replay" || s.source_kind === "simulated_replay")
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
                  <span className={`src ${turn.source_kind}`}>{String(turn.source_kind).replaceAll("_", " ")}</span>
                  <span>{new Date(String(turn.started_at)).toLocaleTimeString()}</span>
                </div>
                <div>{String(turn.text)}</div>
                {showTranslation && turn.translation_text && turn.language !== "en" ? (
                  <div className="translation">Machine translation: {String(turn.translation_text)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
        <aside className="side">
          <section className="card">
            <h3>Customer</h3>
            <div className="row"><span>Name</span><b>{facts.name || "—"}</b></div>
            <div className="row"><span>Phone</span><b>{facts.phone || "—"}</b></div>
            <div className="row"><span>Email</span><b>{facts.email || "—"}</b></div>
            <div className="row"><span>Address</span><b>{facts.address || "—"}</b></div>
            <div className="row"><span>Issue</span><b>{facts.issue || String(view.inquiry.issue || "—")}</b></div>
            <div className="row"><span>Service</span><b>{facts.serviceCode || "—"}</b></div>
          </section>
          <section className="card">
            <h3>Calendar {view.inquiry.calendar_revealed ? "" : "· hidden until scheduling"}</h3>
            {view.appointments.map((appt) => (
              <div key={String(appt.id)}>
                <div>{String(appt.summary)}</div>
                <div className="muted">{new Date(String(appt.starts_at)).toLocaleString("en-US", { timeZone: "America/New_York" })} Eastern</div>
                <div className="muted">{String(appt.technician_id)} · {String(appt.source_kind)} · {String(appt.google_event_id || "no Google event id")}</div>
              </div>
            ))}
            {view.appointments.length === 0 && <p className="muted">No appointment yet.</p>}
          </section>
          <section className="card">
            <h3>Email</h3>
            {view.emails.map((email) => (
              <details key={String(email.id)} className="tool">
                <summary>{String(email.kind)} · {String(email.status)}</summary>
                <div className="muted">{String(email.subject)}</div>
                <div className="muted">Provider id {String(email.provider_message_id || "none")} · {String(email.provider)}</div>
                {email.error ? <div className="demo-flag">{String(email.error)}</div> : null}
                <pre>{String(email.text_body)}</pre>
              </details>
            ))}
          </section>
          <section className="card">
            <h3>Tools</h3>
            {view.tools.map((tool) => (
              <details key={String(tool.id)} className="tool">
                <summary>{String(tool.name)} · {String(tool.status)} · {String(tool.duration_ms ?? "—")} ms</summary>
                <div className="muted">{String(tool.started_at)} · {String(tool.source_kind)}</div>
                <pre>{String(tool.args_redacted_json)}</pre>
                {tool.error ? <div className="demo-flag">{String(tool.error)}</div> : null}
                {tool.result_json ? <pre>{String(tool.result_json)}</pre> : null}
              </details>
            ))}
          </section>
          <section className="card">
            <h3>Attachments</h3>
            {view.attachments.map((file) => (
              <div key={String(file.id)}>
                <div className="demo-flag">{String(file.caption)}</div>
                <img alt="Fictional demo under-sink valve" src={`/api/attachments/${file.id}`} style={{ width: "100%", borderRadius: 12 }} />
              </div>
            ))}
          </section>
          <section className="card">
            <h3>Invoice</h3>
            {!view.invoice && <p className="muted">Waiting for the owner to mark the demo service completed.</p>}
            {view.invoice && (
              <div>
                <div className="demo-flag">{String(view.invoice.demo_banner)}</div>
                <div>{String(view.invoice.number)} · {String(view.invoice.status)}</div>
                {view.lines.map((line) => (
                  <div className="row" key={String(line.id)}><span>{String(line.description_en)}</span><b>{money(Number(line.amount_cents))}</b></div>
                ))}
                <div className="row"><span>Total USD</span><b>{money(Number(view.invoice.total_cents))}</b></div>
                <a href={`/api/invoices/${view.invoice.id}/pdf`}>Download PDF</a>
              </div>
            )}
          </section>
          <section className="card">
            <h3>Review</h3>
            <div>{view.review ? String(view.review.status) : "Not sent"}</div>
            <div className="muted">{view.jobs.map((job) => `${job.kind} ${job.status} ${job.run_at}`).join(" · ") || "No reminder scheduled"}</div>
          </section>
          <section className="card">
            <h3>History</h3>
            {view.events.map((event) => (
              <div key={String(event.id)} className="row">
                <span>{String(event.title)}</span>
                <span className={`src ${event.source_kind}`}>{String(event.source_kind).replaceAll("_", " ")}</span>
              </div>
            ))}
          </section>
        </aside>
      </main>
    </div>
  );
}

function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function labelMode(mode: string): string {
  if (mode === "simulated_replay") return "Simulated replay";
  if (mode === "live") return "Live";
  return "Simulated";
}

async function act(url: string, body?: unknown) {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
}
