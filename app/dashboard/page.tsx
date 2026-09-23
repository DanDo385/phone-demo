import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/http";
import { inquiryList } from "@/lib/view";
import { ScenarioButtons } from "@/components/ScenarioButtons";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const inquiries = inquiryList() as Array<{ id: string; name: string | null; issue: string | null; origin: string; preferred_language: string }>;
  return (
    <main className="lobby">
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo</div>
          <div className="wordmark" style={{ fontSize: 32 }}>Owner dashboard</div>
        </div>
        <Link href="/call">Open phone experience</Link>
      </header>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Run the receptionist scenario</h2>
        <p className="muted">These replays are labeled simulated. They use the same booking, email, and invoice workflow without contacting a real inbox or calendar.</p>
        <ScenarioButtons />
      </section>
      <section className="panel list" style={{ marginTop: 16 }}>
        <h2>Inquiries</h2>
        {inquiries.map((item) => (
          <Link key={item.id} href={`/dashboard/inquiries/${item.id}`}>
            <strong>{item.name || "New caller"}</strong> · {item.preferred_language} · {item.issue || "No issue yet"}
            <div className="muted">{item.origin}</div>
          </Link>
        ))}
      </section>
    </main>
  );
}
