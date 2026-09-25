import { boot, json } from "@/lib/http";
import { mockSlots, spokenTime } from "@/lib/prospect/calendar";
import { addBooking, analysisOf, callForConversation, prospectById } from "@/lib/prospect/store";

// Webhook tools for the prospect demo agent. ElevenLabs sends x-tool-secret from its
// secret store, and prospect_id / conversation_id from dynamic variables.

export async function POST(request: Request, context: { params: Promise<{ name: string }> }) {
  boot();
  const secret = process.env.TOOL_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-tool-secret") !== secret) return json({ error: "Unauthorized tool call" }, 401);
  const { name } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const prospect = prospectById(String(body.prospect_id || ""));
  const analysis = analysisOf(prospect);
  if (!prospect || !analysis) return json({ ok: false, error: "This demo is not set up yet." }, 404);
  const tz = analysis.business.timezone || "America/New_York";
  const conversationId = String(body.conversation_id || "");
  const call = conversationId ? callForConversation(prospect.id, conversationId) : null;

  if (name === "check_availability") {
    const open = mockSlots(prospect.id, analysis).filter((s) => s.status === "open").slice(0, 6);
    return json({
      ok: true,
      timezone: tz,
      slots: open.map((s) => ({ starts_at: s.start, spoken: s.label })),
      note: "Offer two or three of these. Book only one of these exact starts_at values.",
    });
  }

  if (name === "book_appointment") {
    const startsAt = String(body.starts_at || "");
    const slot = mockSlots(prospect.id, analysis).find((s) => s.start === startsAt || new Date(s.start).getTime() === new Date(startsAt).getTime());
    if (!slot) return json({ ok: false, error: "That time is not one of the open slots. Check availability again." });
    if (slot.status !== "open") return json({ ok: false, error: "That time was just taken. Offer another open slot." });
    const service = String(body.service || analysis.services[0]?.name || "Appointment");
    addBooking({
      prospect_id: prospect.id,
      call_id: call?.id ?? null,
      starts_at: slot.start,
      ends_at: slot.end,
      service,
      customer_name: String(body.customer_name || "") || null,
      customer_phone: String(body.customer_phone || "") || null,
      notes: String(body.notes || "") || null,
    });
    return json({ ok: true, confirmed: true, spoken: spokenTime(new Date(slot.start), tz), service });
  }

  if (name === "take_message") {
    // The message is already in the transcript and the post-call summary; nothing else to store.
    return json({ ok: true, recorded: true, promise: "The team will call back during business hours." });
  }

  return json({ ok: false, error: "Unknown tool" }, 404);
}
