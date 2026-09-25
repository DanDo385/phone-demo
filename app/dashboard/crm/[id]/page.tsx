import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentOwner } from "@/lib/http";
import { customerDetail } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const { id } = await params;
  const detail = customerDetail(id);
  if (!detail.customer) notFound();
  const customer = detail.customer as { name?: string | null; phone?: string | null; email?: string | null; status?: string | null; address?: string | null };
  return (
    <main className="lobby">
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo</div>
          <div className="wordmark" style={{ fontSize: 32 }}>{customer.name || "Unnamed customer"}</div>
        </div>
        <Link href="/dashboard/crm">All customers</Link>
      </header>
      <section className="panel" style={{ marginTop: 16 }}>
        <p>{customer.phone || "no phone"} · {customer.email || "no email"}</p>
        <p className="muted">Profile record: {customer.status || "lead"}. This is not the six-stage journey. {customer.address || "No address on the profile."}</p>
        {detail.flags.map((flag) => (
          <p key={String(flag.id)} className="demo-flag">{String(flag.kind)}: {String(flag.detail)}</p>
        ))}
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Inquiries</h2>
        {detail.inquiries.map((inquiry) => (
          <p key={String(inquiry.id)}><Link href={`/dashboard/inquiries/${String(inquiry.id)}`}>{String(inquiry.issue || inquiry.id)}</Link></p>
        ))}
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Notes</h2>
        {detail.notes.map((note) => (
          <p key={String(note.id)}><strong>{String(note.author)}</strong> · {String(note.body)}</p>
        ))}
        <form action={`/api/owner/crm/${id}/notes`} method="post">
          <textarea name="body" required rows={3} style={{ width: "100%" }} />
          <button className="btn" type="submit">Save note</button>
        </form>
      </section>
    </main>
  );
}
