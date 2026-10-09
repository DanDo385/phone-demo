"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOALS, TRADES } from "@/content/marketing/trades";
import { useTurnstile } from "@/components/Turnstile";
import { randomKey } from "@/lib/clientId";
import { track } from "@/lib/track";

export function UpgradeForm() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const [key] = useState(randomKey);
  const [started, setStarted] = useState(false);
  const turnstile = useTurnstile(started);

  function toggle(value: string) {
    setGoals((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setPhase("Reading the public pages we are allowed to fetch.");
    const response = await fetch("/api/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl, mapsUrl, businessName, industry, goals, idempotencyKey: key, turnstileToken: turnstile.token }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    if (!response?.ok || !body?.id) {
      setError(body?.error || "The assessment could not be started.");
      setPhase("");
      setBusy(false);
      turnstile.reset();
      return;
    }
    track("upgrade_started", { has_maps: Boolean(mapsUrl.trim()), industry: industry || "unspecified" });
    router.push(`/upgrade/${body.id}`);
  }

  return (
    <form className="m-form m-card" id="upgrade" onSubmit={submit} onFocus={() => setStarted(true)}>
      <div className="m-field">
        <label htmlFor="up-web">Website</label>
        <input id="up-web" required type="url" inputMode="url" autoComplete="url" placeholder="https://example.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
      </div>
      <div className="m-field">
        <label htmlFor="up-maps">Google Business Profile or Maps link</label>
        <input id="up-maps" type="url" inputMode="url" placeholder="https://maps.google.com/..." value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} />
      </div>
      <div className="m-split">
        <div className="m-field">
          <label htmlFor="up-name">Business name, if we should not guess</label>
          <input id="up-name" autoComplete="organization" maxLength={160} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="m-field">
          <label htmlFor="up-industry">Industry, if it is not obvious</label>
          <select id="up-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">Not specified</option>
            {TRADES.map((trade) => <option key={trade.value} value={trade.value}>{trade.label}</option>)}
          </select>
        </div>
      </div>
      <fieldset className="m-field">
        <legend>Goals, optional</legend>
        <div className="m-goal-grid">
          {GOALS.map((goal) => (
            <label key={goal.value} className="m-check">
              <input type="checkbox" checked={goals.includes(goal.value)} onChange={() => toggle(goal.value)} />
              <span>{goal.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {turnstile.widget}
      {phase && <p className="m-fine" role="status">{phase}</p>}
      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn" type="submit" disabled={busy}>{busy ? "Working" : "See your business upgraded."}</button>
      <p className="m-fine">No account is required to see the assessment. We ask for an email only if you want the report saved.</p>
    </form>
  );
}
