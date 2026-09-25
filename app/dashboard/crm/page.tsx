import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/http";
import { getDemoOffset } from "@/lib/records";
import { customerList } from "@/lib/scoring";
import { demoClockLabel } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const customers = customerList() as Array<{
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    status: string | null;
    inquiries: number;
    open_flags: number;
  }>;
  return (
    <main className="lobby">
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo</div>
          <div className="wordmark" style={{ fontSize: 32 }}>Customers</div>
        </div>
        <span><Link href="/dashboard">Inquiries</Link> · <Link href="/dashboard/prospects">Companies to call</Link></span>
      </header>
      <p className="muted">{demoClockLabel(getDemoOffset())}</p>
      <section className="panel list" style={{ marginTop: 16 }}>
        <p className="muted">The app owns these records. Jev only scores duplicates. It does not merge anyone. A profile status is not the six-stage journey.</p>
        {customers.map((customer) => (
          <Link key={customer.id} href={`/dashboard/crm/${customer.id}`}>
            <strong>{customer.name || "Unnamed"}</strong> · {customer.status || "lead"} · {customer.inquiries} inquiries
            {customer.open_flags ? <span className="demo-flag"> · {customer.open_flags} flag</span> : null}
            <div className="muted">{customer.phone || "no phone"} · {customer.email || "no email"}</div>
          </Link>
        ))}
      </section>
    </main>
  );
}
