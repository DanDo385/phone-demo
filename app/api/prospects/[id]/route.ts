import { boot, json } from "@/lib/http";
import { sweepIdleCalls } from "@/lib/prospect/pipeline";
import { prospectView } from "@/lib/prospect/view";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  boot();
  void sweepIdleCalls();
  const view = prospectView((await context.params).id);
  return view ? json(view) : json({ error: "Not found" }, 404);
}
