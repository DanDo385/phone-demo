import { serviceByCode } from "@/lib/business";
import { DEMO_LABEL } from "@/lib/business";
import { all, get } from "@/lib/db";
import { boot, json } from "@/lib/http";
import { addTimeline, inquiryById, lookupToken } from "@/lib/records";
import { formatSpoken } from "@/lib/time";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  boot();
  const { token } = await context.params;
  const access = lookupToken(token, "continuation");
  if (!access) return json({ error: "expired" }, 401);
  const inquiry = inquiryById(access.inquiry_id);
  if (!inquiry) return json({ error: "missing" }, 404);
  const facts = JSON.parse(inquiry.facts_json) as { issue?: string; name?: string; address?: string; serviceCode?: string };
  const appointment = get<{ starts_at: string }>("SELECT starts_at FROM appointments WHERE inquiry_id = ? AND status = 'booked' ORDER BY created_at DESC LIMIT 1", inquiry.id);
  const messages = all<{ speaker: string; text: string }>("SELECT speaker, text FROM transcript_turns WHERE inquiry_id = ? ORDER BY ordinal DESC LIMIT 8", inquiry.id).reverse();
  if (!get("SELECT id FROM timeline_events WHERE inquiry_id = ? AND kind = 'link_opened'", inquiry.id)) {
    addTimeline({ inquiryId: inquiry.id, kind: "link_opened", title: "Customer opened the continuation link", sourceKind: "live" });
  }
  const service = serviceByCode(facts.serviceCode);
  const lang = inquiry.preferred_language;
  const summary = lang === "es"
    ? `${facts.name || "Hola"}, su solicitud es ${facts.issue || service?.name.es || "una visita"} en ${facts.address || "la dirección indicada"}.`
    : `${facts.name || "Hello"}, your request is ${facts.issue || service?.name.en || "a visit"} at ${facts.address || "the address you gave"}.`;
  return json({
    language: lang,
    summary,
    fictional: DEMO_LABEL[lang],
    appointment: appointment ? formatSpoken(new Date(appointment.starts_at), lang) : undefined,
    messages,
  });
}
