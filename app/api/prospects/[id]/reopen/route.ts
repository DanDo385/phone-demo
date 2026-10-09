import { boot, json } from "@/lib/http";
import { reopenProspectConfirm, prospectById } from "@/lib/prospect/store";

// Returns the prospect to the confirm step. Does not call Places or start analysis.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  boot();
  const { id } = await context.params;
  const row = prospectById(id);
  if (!row || row.source !== "try") return json({ error: "Not found" }, 404);
  reopenProspectConfirm(id);
  return json({ id, status: "matched" });
}
