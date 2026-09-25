"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScenarioButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(scenario: "en" | "es" | "switch") {
    setBusy(true);
    setError("");
    const response = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || !body.inquiryId) {
      setError(body.error || "The replay did not start. Try again.");
      return;
    }
    router.push(`/dashboard/inquiries/${body.inquiryId}`);
  }
  return (
    <div>
      <div className="actions">
        <button className="btn" disabled={busy} onClick={() => run("en")}>English call</button>
        <button className="btn" disabled={busy} onClick={() => run("es")}>Spanish call</button>
        <button className="btn-secondary" disabled={busy} onClick={() => run("switch")}>English, then Spanish</button>
      </div>
      {error ? <p className="demo-flag">{error}</p> : null}
    </div>
  );
}
