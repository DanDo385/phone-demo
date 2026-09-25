import Link from "next/link";
import { boot } from "@/lib/http";
import { reports } from "@/lib/providers/status";

export const dynamic = "force-dynamic";

export default function HomePage() {
  boot();
  const items = reports();
  return (
    <main className="lobby">
      <div className="kicker">Fictional demonstration</div>
      <h1 className="wordmark" style={{ fontSize: 56, margin: "8px 0" }}>Palmetto Coast Home Services</h1>
      <p>A multilingual AI receptionist for a fictional Port St. Lucie contractor. Open the dashboard on a large screen and the phone experience on your phone.</p>
      <div className="grid-2">
        <section className="panel">
          <h2>Two screens</h2>
          <p><Link href="/login">Owner dashboard</Link> — the six-stage journey, transcript, calendar, email, invoice, and reminder.</p>
          <p><Link href="/call">Phone experience</Link> — browser voice, labeled as browser voice rather than a telephone call.</p>
          <p className="muted">Palmetto Coast is not a real business. Prices are demonstration figures. Technicians in this demo conduct visits in English.</p>
        </section>
        <section className="panel">
          <h2>Integrations</h2>
          {items.map((item) => (
            <div key={item.id} className="row"><span>{item.label}</span><b>{item.mode} · {item.verified}</b></div>
          ))}
          <p className="muted">Missing credentials stay in simulated mode. A failed live send is never shown as delivered.</p>
        </section>
      </div>
    </main>
  );
}
