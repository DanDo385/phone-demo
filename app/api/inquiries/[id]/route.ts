import { json, ownerGuard } from "@/lib/http";
import { inquiryView } from "@/lib/view";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const { id } = await context.params;
  const view = inquiryView(id);
  if (!view) return json({ error: "Not found" }, 404);
  return json(view);
}
