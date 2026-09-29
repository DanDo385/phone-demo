import { boot, json } from "@/lib/http";
import { recordEvent } from "@/lib/events";

export async function POST(request: Request) {
  boot();
  const body = await request.json().catch(() => null);
  const result = recordEvent(body);
  return result.ok ? json({ ok: true }) : json({ error: result.error }, 400);
}
