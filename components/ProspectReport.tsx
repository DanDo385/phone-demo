"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProspectView } from "@/lib/prospect/view";

const STAGES = [
  { id: "reading_website", label: "Reading your website" },
  { id: "reading_profile", label: "Checking your Google Business Profile" },
  { id: "writing_script", label: "Writing your receptionist's script and finding gaps" },
  { id: "ready", label: "Ready to call" },
];

type Gap = NonNullable<ProspectView["analysis"]>["gaps"][number];
const GAP_TABS: Array<{ id: "all" | Gap["source"]; label: string }> = [
  { id: "all", label: "All" },
  { id: "website", label: "Website" },
  { id: "google_business_profile", label: "Google profile" },
  { id: "mismatch", label: "Mismatches" },
  { id: "both", label: "Both" },
];

type Session = { endSession: () => Promise<void> };

export default function ProspectReport({ id }: { id: string }) {
  const [view, setView] = useState<ProspectView | null>(null);
  const [missing, setMissing] = useState(false);
  const [gapTab, setGapTab] = useState<(typeof GAP_TABS)[number]["id"]>("all");
  const [browserState, setBrowserState] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [browserError, setBrowserError] = useState("");
  const session = useRef<Session | null>(null);
  const browserCallId = useRef<string>("");
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement>(null);
  const [playhead, setPlayhead] = useState<number | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/prospects/${id}/events`);
    source.onmessage = (event) => setView(JSON.parse(event.data));
    source.addEventListener("gone", () => {
      setMissing(true);
      source.close();
    });
    return () => source.close();
  }, [id]);

  const call = view?.calls[0];
  const lineCount = call?.lines.length ?? 0;
  useEffect(() => {
    if (playhead === null) transcriptEnd.current?.scrollIntoView({ block: "nearest" });
  }, [lineCount, call?.status, playhead]);

  // During playback, the active line is the last one that started at or before the playhead.
  const activeSeq = useMemo(() => {
    if (playhead === null || !call) return -1;
    let seq = -1;
    for (const l of call.lines) if (l.atSecs != null && l.atSecs <= playhead + 0.25) seq = l.seq;
    return seq;
  }, [playhead, call]);
  useEffect(() => {
    if (activeSeq >= 0) document.getElementById(`line-${activeSeq}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSeq]);

  function seek(atSecs: number | null) {
    if (atSecs == null || !player.current) return;
    player.current.currentTime = atSecs;
    void player.current.play();
  }

  async function startBrowserCall() {
    setBrowserState("connecting");
    setBrowserError("");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const response = await fetch(`/api/prospects/${id}/browser-call`, { method: "POST" });
      const body = (await response.json()) as { signedUrl?: string; callId?: string; dynamicVariables?: Record<string, string>; error?: string };
      if (!response.ok || !body.signedUrl) throw new Error(body.error || "Could not start the call");
      browserCallId.current = body.callId || "";
      const mod = await import("@elevenlabs/react");
      session.current = (await mod.Conversation.startSession({
        signedUrl: body.signedUrl,
        dynamicVariables: body.dynamicVariables,
        onConnect: () => setBrowserState("live"),
        onDisconnect: () => {
          setBrowserState("idle");
          session.current = null;
          if (browserCallId.current) void fetch(`/api/prospects/${id}/calls/${browserCallId.current}/end`, { method: "POST" });
        },
        onError: (message: unknown) => setBrowserError(String(message)),
      })) as unknown as Session;
    } catch (error) {
      setBrowserState("error");
      setBrowserError(error instanceof Error ? error.message : "Could not start the call");
    }
  }

  async function hangUp() {
    await session.current?.endSession();
  }

  const gaps = useMemo(() => {
    const all = view?.analysis?.gaps ?? [];
    return gapTab === "all" ? all : all.filter((g) => g.source === gapTab);
  }, [view?.analysis, gapTab]);

  const filler = useMemo(() => {
    const a = view?.analysis;
    if (!a) return [];
    const out: string[] = [];
    const b = a.business;
    if (b.hours_filler) out.push(`Hours: ${b.hours.map((h) => `${h.days} ${h.open}–${h.close}`).join(", ")}`);
    for (const [label, fact] of [
      ["Phone", b.phone_display],
      ["Address", b.address],
      ["Owner", b.owner_or_manager],
      ["Years in business", b.years_in_business],
    ] as const) {
      if (fact.filler) out.push(`${label}: ${fact.value}`);
    }
    for (const s of a.services) if (s.filler) out.push(`Service: ${s.name} (${s.price})`);
    for (const p of a.policies) if (p.filler) out.push(`Policy: ${p.value}`);
    for (const f of a.faqs) if (f.filler) out.push(`FAQ: ${f.question}`);
    return out;
  }, [view?.analysis]);

  const days = useMemo(() => {
    const groups = new Map<string, NonNullable<ProspectView["calendar"]>>();
    for (const slot of view?.calendar ?? []) {
      const key = slot.label.split(" at ")[0];
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    }
    return Array.from(groups.entries()).slice(0, 6);
  }, [view?.calendar]);

  if (missing) {
    return (
      <main className="try-wrap">
        <h1>This demo link has expired.</h1>
        <a className="try-btn" href="/try">Build a new demo</a>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="try-wrap">
        <p className="try-sub">Loading your demo…</p>
      </main>
    );
  }

  const a = view.analysis;
  const stageIndex = STAGES.findIndex((s) => s.id === view.stage);

  if (view.status !== "ready" || !a) {
    return (
      <main className="try-wrap">
        <div className="try-brand">
          <span className="try-dot" /> AI Receptionist Demo
        </div>
        <h1>{view.status === "failed" ? "We couldn't build this demo." : "Building your receptionist…"}</h1>
        <p className="try-sub">{view.website}</p>
        {view.status === "failed" ? (
          <>
            <div className="try-error" style={{ marginTop: 16 }}>{view.error}</div>
            <p style={{ marginTop: 16 }}>
              <a className="try-btn" href="/try">Try again</a>
            </p>
          </>
        ) : (
          <ul className="try-steps">
            {STAGES.map((s, i) => (
              <li key={s.id} className={i < stageIndex ? "done" : i === stageIndex || (stageIndex < 0 && i === 0) ? "now" : ""}>
                <span className="try-step-mark">{i < stageIndex ? "✓" : ""}</span>
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }

  const b = a.business;
  const businessPhone = view.sources?.place.phone || b.phone_display.value;
  const liveCall = call?.status === "live";

  return (
    <main className="try-wrap">
      <div className="try-brand">
        <span className="try-dot" /> AI Receptionist Demo
      </div>
      <h1>{b.name}</h1>
      <p className="try-lede">{b.tagline}</p>

      <div className="try-grid two try-section">
        <section className="try-card try-call">
          <div>
            <h3>Call your receptionist</h3>
            {view.demoLine ? (
              <>
                <a className="try-number" href={`tel:${view.demoLine.e164}`}>{view.demoLine.display}</a>
                <p className="try-sub">
                  {view.callerMatched
                    ? "Call from the number you entered and it answers as your business."
                    : "Call within 15 minutes and it answers as your business."}
                </p>
              </>
            ) : (
              <p className="try-sub">The phone line is being set up. Talk to it in your browser instead.</p>
            )}
          </div>
          {view.browserCall && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {browserState === "live" ? (
                <button className="try-btn danger" onClick={hangUp}>Hang up</button>
              ) : (
                <button className={view.demoLine ? "try-btn ghost" : "try-btn"} onClick={startBrowserCall} disabled={browserState === "connecting" || liveCall}>
                  {browserState === "connecting" ? "Connecting…" : "Talk in your browser"}
                </button>
              )}
            </div>
          )}
          {browserError && <div className="try-error">{browserError}</div>}
          <div>
            <h3>Try saying</h3>
            <div className="try-chips">
              {a.try_saying.map((s) => (
                <span className="try-chip" key={s}>“{s}”</span>
              ))}
            </div>
          </div>
        </section>

        <section className="try-card">
          <div className="try-head">
            <h2>Live transcript</h2>
            {liveCall ? (
              <span className="try-badge high"><span className="try-live" /> Live {call?.channel === "phone" ? "phone call" : "browser call"}</span>
            ) : call ? (
              <span className="try-badge good">Call ended</span>
            ) : null}
          </div>
          {call?.recording && (
            <div className="try-player">
              <audio
                ref={player}
                controls
                preload="metadata"
                src={call.recording}
                onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
                onEnded={() => setPlayhead(null)}
              />
              <p className="try-fine">Play the call back. The line being spoken is highlighted; click any line to jump to it.</p>
            </div>
          )}
          <div className="try-transcript">
            {!call && <div className="try-empty">Call the number and the conversation appears here as you talk.</div>}
            {call?.lines.map((l) => (
              <div
                key={l.seq}
                id={`line-${l.seq}`}
                className={`try-line ${l.speaker}${l.seq === activeSeq ? " active" : ""}${call.recording && l.atSecs != null ? " seekable" : ""}`}
                onClick={() => call.recording && seek(l.atSecs)}
              >
                <small>{l.speaker === "agent" ? "Receptionist" : "You"}</small>
                {l.text}
              </div>
            ))}
            {call && call.status === "ended" && <div className="try-empty">Summarizing the call…</div>}
            {call?.summary && (
              <div>
                <h3 style={{ marginTop: 8 }}>Summary</h3>
                <div className="try-summary">{call.summary}</div>
                <p className="try-fine">
                  {call.emailStatus === "sent"
                    ? `Transcript and summary emailed to ${view.emailMasked}.`
                    : call.emailStatus === "skipped"
                      ? ""
                      : "Email delivery is not set up in this demo yet."}
                </p>
              </div>
            )}
            <div ref={transcriptEnd} />
          </div>
        </section>
      </div>

      <section className="try-section">
        <div className="try-head">
          <h2>How your calls would flow</h2>
          <span className="try-sub">From your side of the phone</span>
        </div>
        <div className="try-flow">
          <div className="try-node">
            <span className="n">1</span>
            <strong>A customer calls</strong>
            <p>{businessPhone ? `They dial ${businessPhone}, the number on your ${view.sources?.place.found ? "Google profile" : "website"}.` : "They dial your business number."}</p>
          </div>
          <div className="try-node">
            <span className="n">2</span>
            <strong>Your phone rings first</strong>
            <p>Your line rings for {a.call_flow.ring_seconds_before_ai} seconds. Answer it and nothing changes.</p>
          </div>
          <div className="try-node gap">
            <span className="n">3</span>
            <strong>No answer, or after hours</strong>
            <p>Today that call goes to voicemail, and most callers try the next business. {a.call_flow.after_hours}</p>
          </div>
          <div className="try-node ai">
            <span className="n">4</span>
            <strong>The AI receptionist answers</strong>
            <p>It answers as {b.name}, quotes your services, and books into your calendar.</p>
          </div>
        </div>
        <div className="try-outcomes">
          <span className="try-badge good">Books appointments</span>
          <span className="try-badge good">Emails you the transcript and summary</span>
          <span className="try-badge good">Takes messages</span>
          {b.languages.length > 1 && <span className="try-badge good">Speaks {b.languages.join(" and ")}</span>}
          <span className="try-badge low">Hands off: {a.call_flow.handoffs.slice(0, 2).join("; ")}</span>
        </div>
      </section>

      <div className="try-grid two try-section">
        <section className="try-card">
          <div className="try-head">
            <h2>What callers can't find</h2>
            <span className="try-sub">{a.gaps.length} gaps</span>
          </div>
          <div className="try-tabs">
            {GAP_TABS.filter((t) => t.id === "all" || a.gaps.some((g) => g.source === t.id)).map((t) => (
              <button key={t.id} className="try-tab" aria-pressed={gapTab === t.id} onClick={() => setGapTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="try-gaps">
            {gaps.map((g) => (
              <div className={`try-gap ${g.severity}`} key={g.title}>
                <strong>{g.title}</strong> <span className={`try-badge ${g.severity}`}>{g.severity}</span>
                <p>{g.detail}</p>
                <p className="why">{g.why_it_matters}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="try-card">
          <div className="try-head">
            <h2>Your calendar</h2>
            <span className="try-sub">Mock calendar for the demo</span>
          </div>
          <div className="try-cal">
            {days.map(([day, slots]) => (
              <div className="try-cal-day" key={day}>
                <h4>{day.replace(/,.*$/, "")}<br /><span className="try-sub">{day.split(", ")[1]}</span></h4>
                {slots.map((s) => (
                  <div key={s.start} className={`try-slot ${s.status}`}>
                    {s.label.split(" at ")[1]?.replace(/ [A-Z]{2,4}$/, "")}
                    {s.status === "booked" && <div>{s.bookedFor || "Booked"}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="try-fine">Book a time on the call and it appears here.</p>
        </section>
      </div>

      <div className="try-grid two try-section">
        <section className="try-card">
          <div className="try-head">
            <h2>Suggested enhancements</h2>
            <span className="try-sub">{view.reportEmail === "sent" ? `Emailed to ${view.emailMasked}` : ""}</span>
          </div>
          <ol className="try-list">
            {a.enhancements.map((e) => (
              <li key={e.title}>
                <strong>{e.title}</strong> <span className={`try-badge ${e.impact}`}>{e.impact} impact</span>
                <br />
                <span>{e.detail}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="try-card">
          <div className="try-head">
            <h2>What the receptionist knows</h2>
            <span className="try-badge filler">{filler.length} filled in</span>
          </div>
          <dl className="try-kv">
            <dt>Services</dt>
            <dd>{a.services.map((s) => `${s.name} (${s.price})`).join("; ")}</dd>
            <dt>Hours</dt>
            <dd>{b.hours.map((h) => `${h.days} ${h.open}–${h.close}`).join(", ")}</dd>
            <dt>Service area</dt>
            <dd>{b.service_area.join(", ")}</dd>
            <dt>Sources</dt>
            <dd>
              {view.sources?.site.ok ? `${view.sources.site.pages.length} website pages` : "Website unreadable"}
              {" · "}
              {view.sources?.place.found ? `Google profile (${view.sources.place.rating ?? "–"}★, ${view.sources.place.reviewCount ?? 0} reviews)` : "No Google profile found"}
            </dd>
          </dl>
          {filler.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Filled in so the demo works</h3>
              <ul className="try-list">
                {filler.map((f) => (
                  <li key={f}><span>{f}</span></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
