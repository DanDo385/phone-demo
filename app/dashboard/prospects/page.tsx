import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/http";
import { DEFAULT_OUTREACH_QUERY, prospectCounts, rankProspects } from "@/lib/prospects";

export const dynamic = "force-dynamic";

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const params = await searchParams;
  const query = params.q?.trim() || DEFAULT_OUTREACH_QUERY;
  const counts = prospectCounts();
  const ranked = await rankProspects(query);
  return (
    <main className="lobby">
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo · outreach list</div>
          <div className="wordmark" style={{ fontSize: 32 }}>Companies to call</div>
        </div>
        <span><Link href="/dashboard">Inquiries</Link> · <Link href="/dashboard/crm">Customers</Link> · <Link href="/dashboard/books">Books</Link></span>
      </header>
      <section className="panel" style={{ marginTop: 16 }}>
        <p className="muted">
          {counts.withoutWebsite} of {counts.total} fictional companies have no website. Code leaves out the ones that already have one, then Jev sorts the rest in one request.
          Nothing on this page places a call or sends email.
        </p>
        <form action="/dashboard/prospects" className="actions" style={{ marginTop: 12 }}>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={DEFAULT_OUTREACH_QUERY}
            aria-label="Outreach search"
            style={{ flex: 1, minWidth: 240, borderRadius: 999, border: "1px solid var(--line)", padding: "10px 14px" }}
          />
          <button className="btn" type="submit">Rank companies</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          {ranked.mode === "jev"
            ? `Jev (${ranked.model}) ranked ${ranked.considered} companies. The number is that company's share of one Choice.`
            : "Rules order. Jev was not called, so this list is a local sort on trade, language, phone, and whether the shop is independent."}
          {ranked.narrowed ? ` Code kept the ${ranked.considered} closest records before the request, because one Choice holds at most 200 options.` : ""}
        </p>
        {ranked.matchLabel ? <p>{ranked.matchLabel} Fit {ranked.matches?.toFixed(2)}. The 0.70 and 0.35 cutoffs are example lines from the TypeSafe search recipe.</p> : null}
      </section>
      <section className="panel list prospects" style={{ marginTop: 16 }}>
        {ranked.rows.map((row) => (
          <article key={row.id}>
            <strong>{row.rank}. {row.name}</strong>
            <span className="muted"> · {row.trade} · {row.city}</span>
            {row.chain ? <span className="pill" style={{ marginLeft: 8 }}>Chain</span> : null}
            {row.spanish ? <span className="pill" style={{ marginLeft: 8 }}>Spanish</span> : null}
            <div className="muted">
              {row.phone || "No phone"} · {ranked.mode === "jev" ? `${(row.signal * 100).toFixed(1)}% of the ranking` : `rules ${row.signal}`}
            </div>
            <div>{row.notes}</div>
          </article>
        ))}
      </section>
    </main>
  );
}
