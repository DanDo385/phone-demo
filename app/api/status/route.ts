import { boot, json } from "@/lib/http";
import { statusPayload } from "@/lib/view";

export async function GET() {
  boot();
  return json(statusPayload());
}
