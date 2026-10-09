"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useTurnstile } from "@/components/Turnstile";
import { analyzerEmailConsent } from "@/content/consent";
import { TRADES } from "@/content/marketing/trades";
import {
  confirmSelected,
  editSearch,
  pickAlternate,
  showAlternates,
  showMatch,
  startSearch,
  type ConfirmState,
  type PlaceCard,
} from "@/lib/prospect/confirm";
import { randomKey, randomUuid } from "@/lib/clientId";
import { track } from "@/lib/track";

// Full analyzer intake for /try: search, confirm the Google listing, then start analysis.
// The homepage hero is a plain form that lands here with ?q=, so this page stays the only client bundle.

type Suggestion = { placeId: string; label: string; secondary: string };

export function AnalyzerEntry() {
  const router = useRouter();
  const listId = useId().replace(/:/g, "");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [gbp, setGbp] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(startSearch());
  const [reviseId, setReviseId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [grantReady, setGrantReady] = useState(false);
  const turnstile = useTurnstile(started);
  const sessionToken = useRef(randomUuid());
  const idempotencyKey = useRef(randomKey());
  const grantSent = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("q") || params.get("website");
    if (params.get("q")) setQuery(params.get("q")!.slice(0, 300));
    if (params.get("website")) setWebsite(params.get("website")!.slice(0, 300));
    const revise = params.get("revise");
    if (revise) {
      setReviseId(revise);
      void fetch(`/api/prospects/${revise}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((view: { website?: string; gbpInput?: string; trade?: string; serviceArea?: string } | null) => {
          if (!view) return;
          if (view.website) setWebsite(view.website);
          if (view.gbpInput) setGbp(view.gbpInput);
          if (view.trade) setTrade(view.trade);
          if (view.serviceArea) setServiceArea(view.serviceArea);
        })
        .catch(() => undefined);
    }
    if (prefill || revise) setStarted(true);
    if (params.get("q")) track("report_started", { from: "hero" });
    else if (params.get("intent") === "call") track("report_started", { from: "try", intent: "call" });
  }, []);

  useEffect(() => {
    if (!turnstile.ready || grantSent.current) return;
    grantSent.current = true;
    void fetch("/api/places/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken: turnstile.token }),
    })
      .then(async (response) => {
        if (!response.ok) {
          grantSent.current = false;
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          setError(body.error || "Verification failed. Refresh and try again.");
          return;
        }
        setGrantReady(true);
      })
      .catch(() => {
        grantSent.current = false;
      });
  }, [turnstile.ready, turnstile.token]);

  useEffect(() => {
    if (!grantReady || picked || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      void fetch("/api/places/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query.trim(), sessionToken: sessionToken.current }),
      })
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((body: { suggestions?: Suggestion[] }) => {
          setSuggestions(body.suggestions ?? []);
          setOpen((body.suggestions ?? []).length > 0);
          setActive(-1);
        })
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, picked, grantReady]);

  function choose(suggestion: Suggestion) {
    setPicked(suggestion);
    setQuery(suggestion.label);
    setSuggestions([]);
    setOpen(false);
  }

  function onQueryKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    track("report_started", { from: reviseId ? "revise" : "try" });
    const response = await fetch("/api/places/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: picked?.placeId || "",
        gbp: gbp.trim() || (picked ? "" : query.trim()),
        website: website.trim(),
        sessionToken: sessionToken.current,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { primary?: PlaceCard; alternates?: PlaceCard[]; via?: string; error?: string };
    setBusy(false);
    if (!response.ok || !body.primary) {
      setError(body.error || "No matching business turned up.");
      return;
    }
    track("business_matched", { via: body.via || "text" });
    setConfirm(showMatch(body.primary, body.alternates ?? []));
    sessionToken.current = randomUuid();
  }

  async function confirmYes() {
    const next = confirmSelected(confirm);
    if (next.step !== "confirmed" || !next.selected) return;
    setBusy(true);
    setError("");
    const payload = {
      website,
      gbp: gbp.trim() || query.trim(),
      email,
      phone,
      trade,
      serviceArea,
      placeId: next.selected.placeId,
      idempotencyKey: idempotencyKey.current,
      emailConsentVersion: analyzerEmailConsent.version,
    };
    const response = await fetch(reviseId ? `/api/prospects/${reviseId}/confirm` : "/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!response.ok || !body.id) {
      setError(body.error || "Something went wrong. Try again.");
      setBusy(false);
      turnstile.reset();
      grantSent.current = false;
      setGrantReady(false);
      return;
    }
    track("business_confirmed", { revised: Boolean(reviseId) });
    router.push(`/try/${body.id}`);
  }

  if (confirm.step === "confirm" || confirm.step === "confirmed") {
    const card = confirm.selected;
    return (
      <section className="try-card try-match" aria-labelledby="match-heading">
        <h2 id="match-heading">Is this your business?</h2>
        {card && (
          <dl>
            <dt>Name</dt>
            <dd>{card.name}</dd>
            {card.address && (<><dt>Address</dt><dd>{card.address}</dd></>)}
            {card.phone && (<><dt>Phone</dt><dd>{card.phone}</dd></>)}
            {card.category && (<><dt>Category</dt><dd>{card.category}</dd></>)}
            {card.rating != null && (
              <>
                <dt>Rating</dt>
                <dd>{card.rating}{card.reviewCount != null ? ` from ${card.reviewCount} reviews` : ""}</dd>
              </>
            )}
            {card.website && (<><dt>Website</dt><dd>{card.website}</dd></>)}
          </dl>
        )}
        <p className="try-fine">Business details from Google. We use them for this report and do not keep a copy of the listing.</p>
        {error && <div className="try-error" role="alert">{error}</div>}
        <div className="try-card-actions">
          <button className="try-btn" type="button" onClick={confirmYes} disabled={busy || !card}>
            {busy ? "Starting…" : "Yes, that's my business"}
          </button>
          {confirm.alternates.length > 0 && (
            <button className="try-btn ghost" type="button" onClick={() => setConfirm(showAlternates(confirm))}>
              Pick a different one
            </button>
          )}
          <button className="try-btn ghost" type="button" onClick={() => setConfirm(editSearch(confirm))}>Back</button>
        </div>
        {confirm.showingAlternates && (
          <ul className="try-alternates">
            {confirm.alternates.map((alt) => (
              <li key={alt.placeId}>
                <button type="button" onClick={() => setConfirm(pickAlternate(confirm, alt.placeId))}>
                  <strong>{alt.name}</strong>
                  {alt.address && <span>{alt.address}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <form className="try-form" onSubmit={lookup} onFocus={() => setStarted(true)}>
      <div className="try-field try-combo">
        <label htmlFor="business">Your business</label>
        <input
          id="business"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          required={!gbp.trim()}
          autoComplete="organization"
          placeholder="Start typing the business name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          onKeyDown={onQueryKey}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && suggestions.length > 0 && (
          <ul className="try-suggestions" id={listId} role="listbox">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.placeId} role="option" id={`${listId}-${index}`} aria-selected={index === active}>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(suggestion)}>
                  <strong>{suggestion.label}</strong>
                  {suggestion.secondary && <span>{suggestion.secondary}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="try-field">
        <label htmlFor="gbp">
          Google profile link <span className="hint">(optional if you picked a suggestion)</span>
        </label>
        <input id="gbp" inputMode="url" placeholder="https://maps.app.goo.gl/… or https://g.page/…" value={gbp} onChange={(e) => setGbp(e.target.value)} />
      </div>
      <div className="try-field">
        <label htmlFor="website">
          Your website <span className="hint">(optional)</span>
        </label>
        <input id="website" inputMode="url" autoComplete="url" placeholder="yourbusiness.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="try-field">
        <label htmlFor="trade">Trade <span className="hint">(optional)</span></label>
        <select id="trade" value={trade} onChange={(e) => setTrade(e.target.value)}>
          <option value="">Select</option>
          {TRADES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="try-field">
        <label htmlFor="area">Service area <span className="hint">(optional)</span></label>
        <input id="area" placeholder="Port St. Lucie and nearby" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} />
      </div>
      {!reviseId && (
        <>
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
        </>
      )}
      {reviseId && <p className="try-fine">We&apos;ll keep the email already on this report.</p>}
      {turnstile.widget}
      {error && <div className="try-error" role="alert">{error}</div>}
      <div>
        <button className="try-btn" disabled={busy || (started && !grantReady)}>
          {busy ? "Searching…" : "Find my business"}
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
