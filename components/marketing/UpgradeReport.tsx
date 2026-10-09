"use client";

import { useState } from "react";
import { upgradeEmailConsent } from "@/content/consent";
import { callsToAction } from "@/lib/brand";
import { useTurnstile } from "@/components/Turnstile";
import type { upgradeView } from "@/lib/upgrade/store";

type View = ReturnType<typeof upgradeView>;

export function UpgradeReport({ initial }: { initial: View }) {
  const [view, setView] = useState(initial);
  const [width, setWidth] = useState<"phone" | "desk">("phone");
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [started, setStarted] = useState(false);
  const turnstile = useTurnstile(started);

  async function retry() {
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/upgrade/${view.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry" }) });
    const body = (await response.json().catch(() => null)) as View | null;
    if (body && "status" in body) setView(body);
    setBusy(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/upgrade/${view.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", email, consentVersion: upgradeEmailConsent.version, turnstileToken: turnstile.token }),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setNotice(body.ok ? "Saved. Sending the report by email is simulated on this server unless mail is configured for a designated recipient." : body.error || "The report could not be saved.");
    setBusy(false);
  }

  return (
    <div className="m-wrap m-page">
      <p className="m-eyebrow">Website assessment</p>
      <h1>{view.preview.name}</h1>
      <p className="m-lede">Status: {view.status}. {view.error || "Findings cite the pages that were fetched. Anything we could not verify is marked that way."}</p>
      <p className="m-fine">Collected {view.updatedAt}. {view.observations.length} source {view.observations.length === 1 ? "note" : "notes"}.</p>
      <div className="m-cta-row">
        <button type="button" className="m-btn m-btn-secondary" disabled={busy} onClick={retry}>Try the fetch again</button>
      </div>

      <section className="m-block" aria-labelledby="found">
        <h2 id="found">Findings</h2>
        {view.findings.length === 0 && <p>No findings yet. If the fetch failed, retry it. This page does not fill in a sample audit of your business.</p>}
        {view.findings.map((finding) => (
          <article key={`${finding.area}-${finding.found}`} className="m-finding">
            <p><span className="m-tag">{finding.kind === "needs_owner" ? "Needs owner access" : finding.kind === "inferred" ? "Inferred" : "Observed"}</span> {finding.area} · {finding.severity}</p>
            <p><strong>What we found.</strong> {finding.found}</p>
            <p><strong>Why it matters.</strong> {finding.why}</p>
            <p><strong>What we would improve.</strong> {finding.improve}</p>
            {finding.sourceUrl && <p className="m-fine">Source: {finding.sourceUrl}</p>}
          </article>
        ))}
      </section>

      <section className="m-block" aria-labelledby="preview">
        <h2 id="preview">Proposed website</h2>
        <p className="m-fine">{view.preview.label}</p>
        <div className="m-preview-tools">
          <button type="button" className="m-btn m-btn-secondary" onClick={() => setWidth("phone")}>Phone</button>
          <button type="button" className="m-btn m-btn-secondary" onClick={() => setWidth("desk")}>Desktop</button>
          <button type="button" className="m-btn m-btn-secondary" onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? "Hide original notes" : "Compare with what we fetched"}</button>
        </div>
        <div style={{ maxWidth: width === "phone" ? 390 : "100%", margin: "0 auto" }}>
          <iframe className="m-preview-frame" title="Proposed website preview" sandbox="" srcDoc={view.preview.html} />
        </div>
        {showOriginal && (
          <ul className="m-bullets">
            {view.observations.map((item) => (
              <li key={`${item.sourceUrl}-${item.note}`}>{item.collectedAt}: {item.note} {item.title ? `(${item.title})` : ""} {item.finalUrl}</li>
            ))}
          </ul>
        )}
        <h3>Changes</h3>
        <ul className="m-bullets">{view.changes.map((change) => <li key={change}>{change}</li>)}</ul>
        <p className="m-promise-text">{callsToAction.preview}</p>
        <p><a className="m-btn" href="/#consult">Request a tailored proposal</a></p>
      </section>

      <section className="m-block" aria-labelledby="profile">
        <h2 id="profile">Proposed profile package</h2>
        <p>{view.profile.authorization}</p>
        <h3>Description</h3>
        <p>{view.profile.description}</p>
        <h3>Services</h3>
        <ul className="m-bullets">{view.profile.services.map((item) => <li key={item}>{item}</li>)}</ul>
        <h3>Photo suggestions</h3>
        <ul className="m-bullets">{view.profile.photoSuggestions.map((item) => <li key={item}>{item}</li>)}</ul>
        <h3>Links</h3>
        <ul className="m-bullets">{view.profile.links.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className="m-block" aria-labelledby="save-report">
        <h2 id="save-report">Email me this report</h2>
        <form className="m-form m-card" onSubmit={save} onFocus={() => setStarted(true)}>
          <div className="m-field"><label htmlFor="save-email">Email</label><input id="save-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <p className="m-fine">{upgradeEmailConsent.text}</p>
          {turnstile.widget}
          <button className="m-btn" disabled={busy} type="submit">Save the report</button>
          {notice && <p role="status">{notice}</p>}
        </form>
      </section>
    </div>
  );
}
