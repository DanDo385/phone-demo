"use client";

import { useState } from "react";
import { foundingEmailConsent, foundingSmsConsent } from "@/content/consent";
import { foundingPage } from "@/content/marketing/founding";
import { TRADES } from "@/content/marketing/trades";
import { useTurnstile } from "@/components/Turnstile";
import { track } from "@/lib/track";

const copy = foundingPage.form;

function newKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function FoundingForm() {
  const [fields, setFields] = useState({ businessName: "", ownerName: "", email: "", mobile: "", trade: "", today: "" });
  // Separate from every other field and never pre-checked (CLAUDE.md).
  const [smsConsent, setSmsConsent] = useState(false);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // One key per filled-in form, so a retry after a network error cannot create a second request.
  const [idempotencyKey] = useState(newKey);
  const turnstile = useTurnstile(started);

  const set = (name: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [name]: e.target.value }));

  function start() {
    if (started) return;
    setStarted(true);
    track("founding_form_start");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/founding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fields,
        smsConsent: Boolean(fields.mobile.trim()) && smsConsent,
        emailConsentVersion: foundingEmailConsent.version,
        smsConsentVersion: foundingSmsConsent.version,
        idempotencyKey,
        turnstileToken: turnstile.token,
      }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => ({}))) as { ok?: boolean; error?: string } | undefined;
    if (!response?.ok || !body?.ok) {
      setError(body?.error || "Something went wrong. Try again.");
      setBusy(false);
      turnstile.reset();
      return;
    }
    track("founding_form_submit", { trade: fields.trade, sms_opt_in: Boolean(fields.mobile.trim()) && smsConsent });
    setDone(true);
  }

  if (done) {
    return <p className="m-card m-done" role="status">{copy.done}</p>;
  }

  return (
    <form className="m-form m-card" onSubmit={submit} onFocus={start}>
      <h2>{copy.heading}</h2>
      <div className="m-field">
        <label htmlFor="f-business">{copy.businessName}</label>
        <input id="f-business" required autoComplete="organization" maxLength={120} value={fields.businessName} onChange={set("businessName")} />
      </div>
      <div className="m-field">
        <label htmlFor="f-name">{copy.ownerName}</label>
        <input id="f-name" required autoComplete="name" maxLength={120} value={fields.ownerName} onChange={set("ownerName")} />
      </div>
      <div className="m-field">
        <label htmlFor="f-email">{copy.email}</label>
        <input id="f-email" required type="email" autoComplete="email" maxLength={254} value={fields.email} onChange={set("email")} />
      </div>
      <div className="m-field">
        <label htmlFor="f-mobile">{copy.mobile}</label>
        <input id="f-mobile" type="tel" autoComplete="tel" maxLength={40} value={fields.mobile} onChange={set("mobile")} />
      </div>
      <div className="m-check">
        <input id="f-sms" type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} disabled={!fields.mobile.trim()} />
        <label htmlFor="f-sms">{foundingSmsConsent.text}</label>
      </div>
      <div className="m-field">
        <label htmlFor="f-trade">{copy.trade}</label>
        <select id="f-trade" required value={fields.trade} onChange={set("trade")}>
          <option value="">Choose one</option>
          {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="m-field">
        <label htmlFor="f-today">{copy.today}</label>
        <textarea id="f-today" required rows={4} maxLength={1500} value={fields.today} onChange={set("today")} />
      </div>
      {turnstile.widget}
      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn" type="submit" disabled={busy || (started && !turnstile.ready)}>{busy ? copy.sending : copy.submit}</button>
      <p className="m-fine">{foundingEmailConsent.text}</p>
      <p className="m-fine">{foundingPage.never}</p>
    </form>
  );
}
