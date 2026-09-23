import { json, ownerGuard } from "@/lib/http";
import { cancelReminder } from "@/lib/reminders";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (body.action === "cancel") cancelReminder(id, "owner");
  return json({ ok: true });
}
