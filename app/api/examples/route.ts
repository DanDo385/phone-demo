import { json } from "@/lib/http";
import { getDb } from "@/lib/db";
import { SHOWCASE } from "@/lib/ops/ids";
import { showcaseSnapshot } from "@/lib/ops/showcase";
import { finishVerification, lookupAuthorizedInvoice, publishContent, sendCustomerMessage, setInquiryLanguage, startVerification } from "@/lib/ops/workflow";

export async function GET() {
  getDb();
  return json(showcaseSnapshot());
}

export async function POST(request: Request) {
  getDb();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;
  if (action === "message") {
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
    if (!text) return json({ error: "Write a message first." }, 400);
    const channel = typeof body.channel === "string" ? body.channel : "web";
    const language = body.language === "es" ? "es" : "en";
    setInquiryLanguage({ businessId: SHOWCASE.roofing, inquiryId: SHOWCASE.inquiry, language });
    const sent = sendCustomerMessage({ businessId: SHOWCASE.roofing, inquiryId: SHOWCASE.inquiry, channel, body: text, actor: "examples" });
    if (!sent.ok) return json({ error: sent.error }, 400);
    return json({ delivery: sent.delivery, reason: sent.reason, snapshot: showcaseSnapshot() });
  }
  if (action === "code") {
    const customerId = body.customerId === SHOWCASE.sam ? SHOWCASE.sam : SHOWCASE.maya;
    const started = startVerification({ businessId: SHOWCASE.roofing, customerId });
    if (!started.ok) return json({ error: started.error }, 400);
    return json({ delivery: started.delivery, reason: started.reason, code: started.code, customerId });
  }
  if (action === "verify") {
    const customerId = body.customerId === SHOWCASE.sam ? SHOWCASE.sam : SHOWCASE.maya;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const finished = finishVerification({ businessId: SHOWCASE.roofing, customerId, code });
    if (!finished.ok) return json({ error: finished.error }, 400);
    return json({ token: finished.token });
  }
  if (action === "invoice") {
    const token = typeof body.token === "string" ? body.token : "";
    const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
    const found = lookupAuthorizedInvoice(token, invoiceId);
    if (!found.ok) return json({ error: found.error }, 404);
    return json({ invoice: found.invoice });
  }
  if (action === "publish") {
    const contentId = typeof body.contentId === "string" ? body.contentId : SHOWCASE.content;
    const published = publishContent({ businessId: SHOWCASE.roofing, contentId, actor: "examples" });
    if (!published.ok) return json({ error: published.error }, 400);
    return json({ status: published.status, detail: published.detail, snapshot: showcaseSnapshot() });
  }
  return json({ error: "Unknown action." }, 400);
}
