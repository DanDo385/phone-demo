import Link from "next/link";
import { redirect } from "next/navigation";
import { channelReports } from "@/lib/channels";
import { currentOwner } from "@/lib/http";
import { showcaseSnapshot } from "@/lib/ops/showcase";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const snap = showcaseSnapshot();
  const channels = channelReports();
  return (
    <main className="lobby">
      <header className="topbar">
        <div>
          <div className="kicker">Fictional operations sample</div>
          <div className="wordmark" style={{ fontSize: 32 }}>Workflow</div>
        </div>
        <Link href="/dashboard">Back to the earlier sample</Link>
      </header>
      <p className="muted">Signed in as {owner.email}. These rows are the fictional roofing and industrial examples. They are not live customer records.</p>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Channels</h2>
        {channels.map((item) => (
          <div key={item.id} className="row"><span>{item.label}</span><b>{item.state}</b></div>
        ))}
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Inquiries</h2>
        {snap.inquiries.map((inquiry) => (
          <p key={inquiry.id}><b>{inquiry.priority}</b> {inquiry.summary}<br />{inquiry.priority_reason}</p>
        ))}
        <p><Link href="/examples">Open the public example</Link></p>
      </section>
    </main>
  );
}
