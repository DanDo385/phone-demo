"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { analyzerEmailConsent } from "@/content/consent";
import { useTurnstile } from "@/components/Turnstile";
import { track } from "@/lib/track";

// The analyzer intake, shared by the homepage hero and /try.
// - "hero": the first input only. It hands the website to /try, which finishes the form.
// - "full": the whole intake. It starts the analysis (paid calls), so it is Turnstile-gated.

type Props = { variant: "hero"; ctaLabel: string; note?: string } | { variant: "full" };

export function AnalyzerEntry(props: Props) {
  return props.variant === "hero" ? <HeroEntry ctaLabel={props.ctaLabel} note={props.note} /> : <FullEntry />;
}

function HeroEntry({ ctaLabel, note }: { ctaLabel: string; note?: string }) {
  const router = useRouter();
  const [website, setWebsite] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    track("report_start", { from: "hero" });
    router.push(`/try?website=${encodeURIComponent(website.trim())}`);
  }

  return (
    <form className="m-analyzer" onSubmit={submit} id="report">
      <label htmlFor="hero-website">Your website</label>
      <div className="m-analyzer-row">
        <input
          id="hero-website"
          required
          inputMode="url"
          autoComplete="url"
          placeholder="yourbusiness.com"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <button className="m-btn" type="submit">{ctaLabel}</button>
      </div>
      {note && <p className="m-fine">{note}</p>}
    </form>
  );
}

function FullEntry() {
  const router = useRouter();
  const [website, setWebsite] = useState("");
  const [gbp, setGbp] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState("report");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const turnstile = useTurnstile(started);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("website");
    if (prefill) {
      setWebsite(prefill.slice(0, 300));
      setStarted(true);
    }
    const wanted = params.get("intent");
    if (wanted === "call") setIntent("call");
    track("analyzer_view", { intent: wanted === "call" ? "call" : "report", prefilled: Boolean(prefill) });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website, gbp, email, phone, turnstileToken: turnstile.token, emailConsentVersion: analyzerEmailConsent.version }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!response.ok || !body.id) {
      setError(body.error || "Something went wrong. Try again.");
      setBusy(false);
      turnstile.reset();
      return;
    }
    track("analyzer_submit", { intent });
    router.push(`/try/${body.id}`);
  }

  return (
    <form className="try-form" onSubmit={submit} onFocus={() => setStarted(true)}>
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
          Mobile number you&apos;ll call from <span className="hint">(so the receptionist knows it&apos;s your demo)</span>
        </label>
        <input id="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {turnstile.widget}
      {error && <div className="try-error" role="alert">{error}</div>}
      <div>
        <button className="try-btn" disabled={busy || (started && !turnstile.ready)}>
          {busy ? "Starting…" : intent === "call" ? "Build my receptionist" : "Build my report and receptionist"}
        </button>
      </div>
      <p className="try-fine">{analyzerEmailConsent.text}</p>
      <p className="try-fine">
        We read your public website and Google profile only. Anything we can&apos;t find, like prices or policies, is filled in
        with typical values so the demo call works, and marked as filled in. Your email and number are used only for this demo.
      </p>
    </form>
  );
}
