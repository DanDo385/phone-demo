"use client";

import { useState } from "react";
import { SHOWCASE } from "@/lib/ops/ids";

type Snapshot = {
  inquiries: Array<{ id: string; summary: string; priority: string; priority_reason: string; channel: string; language: string; status: string }>;
  messages: Array<{ id: string; channel: string; direction: string; body: string; delivery: string; delivery_reason: string | null }>;
  files: Array<{ id: string; filename: string; permission: string }>;
  content: Array<{ id: string; status: string; concept: { hook: string; platform: string; cost: string; why: string } }>;
  publications: Array<{ content_id: string; status: string; detail: string; url: string | null }>;
  jobs: Array<{ id: string; title: string; stage: string; notes: string | null }>;
};

export function ShowcaseDesk({ initial }: { initial: Snapshot }) {
  const [snap, setSnap] = useState(initial);
  const [text, setText] = useState("Please send the proposal to Priya as well.");
  const [channel, setChannel] = useState("web");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [invoice, setInvoice] = useState("");
  const [customerId, setCustomerId] = useState<string>(SHOWCASE.maya);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/examples", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { response, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  }

  return (
    <div className="m-grid-3" style={{ marginTop: 16 }}>
      <section className="m-card">
        <h2>Same inquiry, another channel</h2>
        <label htmlFor="ex-text">Message</label>
        <textarea id="ex-text" rows={3} value={text} onChange={(event) => setText(event.target.value)} />
        <label htmlFor="ex-channel">Channel</label>
        <select id="ex-channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
          <option value="web">Website chat</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp (not approved)</option>
        </select>
        <button className="m-btn" type="button" onClick={async () => {
          const result = await post({ action: "message", text, channel, language: "en" });
          const delivery = String(result.body.delivery || "");
          setNotice(delivery ? `${delivery}. ${String(result.body.reason || "")}` : String(result.body.error || "Could not store the message."));
          if (result.body.snapshot) setSnap(result.body.snapshot as Snapshot);
        }}>Store the message</button>
        {notice && <p role="status">{notice}</p>}
        <ul className="m-bullets">
          {snap.messages.map((message) => (
            <li key={message.id}>{message.channel} · {message.direction} · {message.delivery}: {message.body}</li>
          ))}
        </ul>
      </section>

      <section className="m-card">
        <h2>Photo on the job</h2>
        <form onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const response = await fetch("/api/examples/media", { method: "POST", body: data });
          const body = (await response.json().catch(() => ({}))) as { snapshot?: Snapshot; error?: string };
          if (body.snapshot) setSnap(body.snapshot);
          setNotice(body.error || "File stored with the fictional inquiry and job.");
        }}>
          <label htmlFor="ex-file">JPEG, PNG, WebP, PDF, or text</label>
          <input id="ex-file" name="file" type="file" required />
          <button className="m-btn" type="submit">Attach to the inquiry</button>
        </form>
        <ul className="m-bullets">{snap.files.map((file) => <li key={file.id}>{file.filename} · {file.permission}</li>)}</ul>
      </section>

      <section className="m-card">
        <h2>Invoice after a code</h2>
        <label htmlFor="ex-who">Account</label>
        <select id="ex-who" value={customerId} onChange={(event) => { setCustomerId(event.target.value); setToken(""); setInvoice(""); }}>
          <option value={SHOWCASE.maya}>Maya Ellison</option>
          <option value={SHOWCASE.sam}>Sam Patel</option>
        </select>
        <button className="m-btn m-btn-secondary" type="button" onClick={async () => {
          const result = await post({ action: "code", customerId });
          setCode(String(result.body.code || ""));
          setNotice(String(result.body.reason || result.body.error || ""));
        }}>Email a one-time code</button>
        {code && <p>Simulated delivery. The code is shown because no email was sent: <strong>{code}</strong></p>}
        <button className="m-btn m-btn-secondary" type="button" onClick={async () => {
          const result = await post({ action: "verify", customerId, code });
          if (typeof result.body.token === "string") setToken(result.body.token);
          setNotice(typeof result.body.token === "string" ? "Signed in for this fictional account." : String(result.body.error || "The code was not accepted."));
        }}>Use the code</button>
        <button className="m-btn" type="button" onClick={async () => {
          const result = await post({ action: "invoice", token, invoiceId: SHOWCASE.mayaInvoice });
          const found = result.body.invoice as { amountLabel?: string; externalRef?: string } | undefined;
          setInvoice(found ? `${found.externalRef}: ${found.amountLabel}` : String(result.body.error || "No invoice."));
        }}>Open Maya&apos;s invoice</button>
        {invoice && <p role="status">{invoice}</p>}
        <p className="m-fine">Sam&apos;s sign-in cannot open Maya&apos;s invoice. A phone number alone is not accepted.</p>
      </section>

      <section className="m-card">
        <h2>Content stays unpublished</h2>
        <ul className="m-bullets">
          {snap.content.map((item) => <li key={item.id}>{item.concept.hook} · {item.status} · {item.concept.cost}</li>)}
        </ul>
        <button className="m-btn" type="button" onClick={async () => {
          const result = await post({ action: "publish", contentId: SHOWCASE.content });
          setNotice(String(result.body.detail || result.body.error || ""));
          if (result.body.snapshot) setSnap(result.body.snapshot as Snapshot);
        }}>Publish the approved draft</button>
        <ul className="m-bullets">
          {snap.publications.map((item) => <li key={item.content_id}>{item.status}: {item.detail}{item.url ? ` ${item.url}` : ""}</li>)}
        </ul>
        <p className="m-fine">Jobs: {snap.jobs.map((job) => `${job.title} (${job.stage})`).join("; ")}</p>
      </section>
    </div>
  );
}
