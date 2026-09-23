import { json } from "@/lib/http";
import { boot } from "@/lib/http";
import { executeTool } from "@/lib/tools";
import type { ToolName } from "@/lib/types";

const NAMES = new Set(["save_customer_details", "lookup_service_info", "calculate_estimate", "send_continuation_link", "check_availability", "book_appointment", "request_human_followup"]);

export async function POST(request: Request, context: { params: Promise<{ name: string }> }) {
  boot();
  const secret = process.env.TOOL_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-tool-secret") !== secret) return json({ error: "Unauthorized tool call" }, 401);
  const { name } = await context.params;
  if (!NAMES.has(name)) return json({ error: "Unknown tool" }, 404);
  const body = await request.json();
  const inquiryId = String(body.inquiry_id || "");
  if (!inquiryId) return json({ error: "inquiry_id is required" }, 400);
  const result = await executeTool({
    inquiryId,
    sourceKind: "live",
    delivery: "connected",
    call: {
      name: name as ToolName,
      args: body,
      idempotencyKey: String(body.tool_call_id || `${name}:${inquiryId}:${JSON.stringify(body).slice(0, 180)}`),
    },
  });
  return json(result, result.ok ? 200 : 409);
}
