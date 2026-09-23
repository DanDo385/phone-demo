import { json, ownerGuard } from "@/lib/http";
import { advanceClockToReminder, advanceDemoClock, tickReminders } from "@/lib/reminders";

export async function POST(request: Request) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const body = await request.json().catch(() => ({}));
  const moved = body.inquiryId ? advanceClockToReminder(String(body.inquiryId)) : { offset: advanceDemoClock(48 * 60 * 60 * 1000), runAt: null };
  await tickReminders();
  return json({ ...moved, accelerated: true, note: "Demo clock advanced. A real 48-hour wait did not elapse." });
}
