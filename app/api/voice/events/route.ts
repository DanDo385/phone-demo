import { json, ownerGuard } from "@/lib/http";
import { activeSession, addTurn, inquiryById } from "@/lib/records";

export async function POST(request: Request) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const body = await request.json();
  const inquiry = inquiryById(String(body.inquiryId || ""));
  if (!inquiry) return json({ error: "Not found" }, 404);
  const session = activeSession(inquiry.id);
  if (!session) return json({ error: "No session" }, 404);
  addTurn({
    inquiryId: inquiry.id,
    sessionId: session.id,
    speaker: body.speaker === "agent" ? "agent" : "caller",
    text: String(body.text || ""),
    language: inquiry.preferred_language,
    sourceKind: "live",
  });
  return json({ ok: true });
}
