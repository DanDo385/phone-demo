"use client";

import { useState } from "react";
import { consultEmailConsent } from "@/content/consent";
import { TRADES } from "@/content/marketing/trades";
import { useTurnstile } from "@/components/Turnstile";
import { randomKey } from "@/lib/clientId";
import { track } from "@/lib/track";

export function ConsultForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [industry, setIndustry] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [key] = useState(randomKey);
  const [started, setStarted] = useState(false);
  const turnstile = useTurnstile(started);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/consult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, business, industry, note, consentVersion: consultEmailConsent.version, idempotencyKey: key, turnstileToken: turnstile.token }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => ({}))) as { ok?: boolean; notify?: string; error?: string } | undefined;
    if (!response?.ok || !body?.ok) {
      setError(body?.error || "The form could not be sent.");
      setBusy(false);
      turnstile.reset();
      return;
    }
    track("consult_submit", { industry: industry || "unspecified" });
    setDone(body.notify === "sent" ? "Sent. We will reply by email." : body.notify === "failed" ? "Saved, but the notification email failed. We still have your request." : "Saved. Email delivery is simulated on this server, so no message was sent.");
  }

  if (done) return <p className="m-card m-done" role="status">{done}</p>;

  return (
    <form className="m-form m-card" id="consult" onSubmit={submit} onFocus={() => setStarted(true)}>
      <div className="m-field"><label htmlFor="c-name">Your name</label><input id="c-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="m-field"><label htmlFor="c-email">Email</label><input id="c-email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="m-field"><label htmlFor="c-business">Business</label><input id="c-business" autoComplete="organization" value={business} onChange={(e) => setBusiness(e.target.value)} /></div>
      <div className="m-field">
        <label htmlFor="c-industry">Industry</label>
        <select id="c-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">Not specified</option>
          {TRADES.map((trade) => <option key={trade.value} value={trade.value}>{trade.label}</option>)}
        </select>
      </div>
      <div className="m-field"><label htmlFor="c-note">What do you want to improve?</label><textarea id="c-note" required rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <p className="m-fine">{consultEmailConsent.text}</p>
      {turnstile.widget}
      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn" disabled={busy} type="submit">{busy ? "Sending" : "Request a tailored proposal"}</button>
    </form>
  );
}
