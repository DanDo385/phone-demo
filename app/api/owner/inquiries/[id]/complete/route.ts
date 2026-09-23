import { json, ownerGuard } from "@/lib/http";
import { completeDemoService } from "@/lib/invoice";
import { mailConfigured } from "@/lib/providers/status";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const { id } = await context.params;
  const result = await completeDemoService({
    inquiryId: id,
    ownerName: owner.name,
    delivery: mailConfigured() ? "connected" : "simulated",
    sourceKind: mailConfigured() ? "live" : "simulated",
  });
  return json(result, result.ok ? 200 : 409);
}
