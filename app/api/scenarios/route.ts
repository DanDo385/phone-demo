import { json, ownerGuard } from "@/lib/http";
import { runScenario } from "@/lib/replay";

export async function POST(request: Request) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const body = await request.json();
  const scenario = body.scenario;
  if (scenario !== "en" && scenario !== "es" && scenario !== "switch") return json({ error: "Unknown scenario" }, 400);
  const inquiryId = await runScenario(scenario);
  return json({ inquiryId, mode: "simulated_replay" });
}
