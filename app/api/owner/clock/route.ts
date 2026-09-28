import { get } from "@/lib/db";
import { json, ownerGuard } from "@/lib/http";
import { advanceClockToReminder, advanceDemoClock, tickReminders } from "@/lib/reminders";

export async function POST(request: Request) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const body = await request.json().catch(() => ({}));
  const moved = body.inquiryId ? advanceClockToReminder(String(body.inquiryId)) : { offset: advanceDemoClock(48 * 60 * 60 * 1000), runAt: null };
  await tickReminders();
  let note = "Demo clock advanced. A real 48-hour wait did not elapse.";
  if (body.inquiryId && !moved.runAt) {
    const job = get<{ status: string }>(
      "SELECT status FROM scheduled_jobs WHERE inquiry_id = ? AND kind = 'review_reminder' ORDER BY created_at DESC LIMIT 1",
      String(body.inquiryId),
    );
    note = job
      ? "A second reminder was not created. The demo clock was not moved."
      : "No reminder is scheduled yet. The demo clock was not moved.";
  }
  return json({ ...moved, accelerated: true, note });
}
