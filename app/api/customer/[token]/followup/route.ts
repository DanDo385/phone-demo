import { boot, json } from "@/lib/http";
import { lookupToken } from "@/lib/records";
import { executeTool } from "@/lib/tools";

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  boot();
  const { token } = await context.params;
  const access = lookupToken(token, "continuation");
  if (!access) return json({ error: "expired" }, 401);
  const result = await executeTool({
    inquiryId: access.inquiry_id,
    sourceKind: "simulated",
    delivery: "simulated",
    call: {
      name: "request_human_followup",
      args: { reason: "Customer requested follow-up from the continuation page" },
      idempotencyKey: `followup:${access.inquiry_id}:page`,
    },
  });
  return json(result);
}
