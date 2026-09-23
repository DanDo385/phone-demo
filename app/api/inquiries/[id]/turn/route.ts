import { json, ownerGuard } from "@/lib/http";
import { customerTurn } from "@/lib/turn";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const { id } = await context.params;
  const body = await request.json();
  const outcome = await customerTurn(id, String(body.text || ""));
  return json(outcome);
}
