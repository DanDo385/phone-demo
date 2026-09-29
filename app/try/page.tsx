"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TryIntake() {
  const router = useRouter();
  const [website, setWebsite] = useState("");
  const [gbp, setGbp] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website, gbp, email, phone }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!response.ok || !body.id) {
      setError(body.error || "Something went wrong. Try again.");
      setBusy(false);
      return;
    }
    router.push(`/try/${body.id}`);
  }

  return (
    <main className="try-wrap">
      <div className="try-brand">
        <span className="try-dot" /> AI Receptionist Demo
      </div>
      <h1>Hear an AI receptionist answer as your business.</h1>
      <p className="try-lede">
        Enter your website and Google Business Profile. In about a minute you get a receptionist trained on your services,
        a report of what callers can't find today, and a number to call.
      </p>
      <form className="try-form" onSubmit={submit}>
        <div className="try-field">
          <label htmlFor="website">Your website</label>
          <input id="website" required inputMode="url" autoComplete="url" placeholder="yourbusiness.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div className="try-field">
          <label htmlFor="gbp">
            Google Business Profile <span className="hint">(Maps link, or business name and city)</span>
          </label>
          <input id="gbp" placeholder="https://maps.app.goo.gl/… or Acme Plumbing, Austin TX" value={gbp} onChange={(e) => setGbp(e.target.value)} />
        </div>
        <div className="try-field">
          <label htmlFor="email">
            Email <span className="hint">(we send your report and call transcript here)</span>
          </label>
          <input id="email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="try-field">
          <label htmlFor="phone">
            Mobile number you'll call from <span className="hint">(so the receptionist knows it's your demo)</span>
          </label>
          <input id="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {error && <div className="try-error">{error}</div>}
        <div>
          <button className="try-btn" disabled={busy}>
            {busy ? "Starting…" : "Build my receptionist"}
          </button>
        </div>
        <p className="try-fine">
          We read your public website and Google profile only. Anything we can't find, like prices or policies, is filled in
          with typical values so the demo call works, and marked as filled in. Your email and number are used only for this demo.
        </p>
      </form>
    </main>
  );
}
