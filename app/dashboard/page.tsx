import Link from "next/link";
import { redirect } from "next/navigation";
import { ScenarioButtons } from "@/components/ScenarioButtons";
import { currentOwner } from "@/lib/http";
import { reports } from "@/lib/providers/status";
import { getDemoOffset } from "@/lib/records";
import { demoClockLabel } from "@/lib/time";
import { inquiryList } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const { rows, total, cap } = inquiryList() as {
    rows: Array<{ id: string; name: string | null; issue: string | null; origin: string; preferred_language: string; tool_failed: number; email_failed: number }>;
    total: number;
    cap: number;
  };
  const integrations = reports();
  return (
    <main className="lobby">
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo</div>
          <div className="wordmark" style={{ fontSize: 32 }}>Owner dashboard</div>
        </div>
        <span><Link href="/dashboard/crm">Customers</Link> · <Link href="/dashboard/books">Books</Link> · <Link href="/dashboard/prospects">Companies to call</Link> · <Link href="/call">Open phone experience</Link></span>
      </header>
      <p className="muted">{demoClockLabel(getDemoOffset())}</p>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Integrations</h2>
        <p className="muted">Each row is the mode on this machine and whether a successful call has verified it. Unverified is not a live success.</p>
        {integrations.map((item) => (
          <div key={item.id} className="row"><span>{item.label}</span><b>{item.mode} · {item.verified}</b></div>
        ))}
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Run the receptionist scenario</h2>
        <p className="muted">These replays are labeled simulated. They use the same booking, email, and invoice workflow without contacting a real inbox or calendar.</p>
        <ScenarioButtons />
      </section>
      <section className="panel list" style={{ marginTop: 16 }}>
        <h2>Inquiries</h2>
        {total > rows.length ? <p className="muted">Showing {rows.length} of {total}. The list stops at {cap}.</p> : null}
        {rows.length === 0 ? <p className="muted">No inquiries yet. Start with English call.</p> : null}
        {rows.map((item) => (
          <Link key={item.id} href={`/dashboard/inquiries/${item.id}`}>
            <strong>{item.name || "New caller"}</strong> · {item.preferred_language}
            {item.tool_failed || item.email_failed ? <span className="pill failed"> Needs a look</span> : null}
            <div>{item.issue || "No issue yet"}</div>
            <div className="muted">{originLabel(item.origin)}</div>
          </Link>
        ))}
      </section>
    </main>
  );
}

function originLabel(origin: string): string {
  if (origin === "simulated_replay") return "Simulated replay";
  return origin.replaceAll("_", " ");
}
