import { run } from "@/lib/db";
import { boot, json } from "@/lib/http";
import { addLanguageEvent, inquiryById, lookupToken, nowIso } from "@/lib/records";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  boot();
  const { token } = await context.params;
  const access = lookupToken(token, "continuation");
  if (!access) return json({ error: "expired" }, 401);
  const body = await request.json();
  const language = body.language === "es" ? "es" : "en";
  const inquiry = inquiryById(access.inquiry_id);
  run("UPDATE inquiries SET preferred_language = ?, language_lock = 'explicit', updated_at = ? WHERE id = ?", language, nowIso(), access.inquiry_id);
  if (inquiry?.customer_id) run("UPDATE customers SET preferred_language = ? WHERE id = ?", language, inquiry.customer_id);
  const facts = JSON.parse(inquiry?.facts_json || "{}");
  facts && run("UPDATE inquiries SET facts_json = ? WHERE id = ?", JSON.stringify(facts), access.inquiry_id);
  addLanguageEvent({
    inquiryId: access.inquiry_id,
    from: inquiry?.preferred_language,
    to: language,
    reason: "Customer selected a language on the continuation page",
    sourceKind: "live",
  });
  return json({ ok: true, language });
}
