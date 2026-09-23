"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScenarioButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(scenario: "en" | "es" | "switch") {
    setBusy(true);
    const response = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
    const body = await response.json();
    setBusy(false);
    if (response.ok) router.push(`/dashboard/inquiries/${body.inquiryId}`);
  }
  return (
    <div className="actions">
      <button className="btn" disabled={busy} onClick={() => run("en")}>English call</button>
      <button className="btn" disabled={busy} onClick={() => run("es")}>Spanish call</button>
      <button className="btn-secondary" disabled={busy} onClick={() => run("switch")}>English, then Spanish</button>
    </div>
  );
}
