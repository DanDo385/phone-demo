import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import { booksBalance, recentJournals, trialBalance } from "@/lib/ledger";
import { openFlags } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const balance = booksBalance();
  const accounts = trialBalance();
  const journals = recentJournals();
  const flags = openFlags();
  return (
    <main className="lobby">
      <header className="topbar">
        <div>
          <div className="kicker">Fictional demo</div>
          <div className="wordmark" style={{ fontSize: 32 }}>Books</div>
        </div>
        <Link href="/dashboard">Inquiries</Link>
      </header>
      <section className="panel" style={{ marginTop: 16 }}>
        <p className={balance.balanced ? "muted" : "demo-flag"}>
          {balance.balanced ? "In balance" : "Out of balance"} · debits {formatMoney(balance.debit)} · credits {formatMoney(balance.credit)}
        </p>
        <p className="muted">The app posts the journal. Jev may flag a categorization. It cannot rewrite a line. Demo invoices do not collect cash, so receivable stays open until a payment is posted.</p>
        <table className="books">
          <thead>
            <tr><th>Account</th><th>Debit</th><th>Credit</th></tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.code}>
                <td>{account.code} {account.name}</td>
                <td className="num">{account.debit ? formatMoney(account.debit) : ""}</td>
                <td className="num">{account.credit ? formatMoney(account.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Journals</h2>
        {journals.map((journal) => (
          <p key={journal.id}>{journal.memo} · {journal.source_type} · {formatMoney(Number(journal.debit))}</p>
        ))}
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Flags</h2>
        {flags.length === 0 ? <p className="muted">None open.</p> : null}
        {flags.map((flag) => (
          <p key={String(flag.id)} className="demo-flag">{String(flag.kind)} · {String(flag.detail)}</p>
        ))}
      </section>
    </main>
  );
}
