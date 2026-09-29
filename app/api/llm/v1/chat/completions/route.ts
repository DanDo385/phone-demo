import { boot, json } from "@/lib/http";
import { relayChat, type ChatRequest } from "@/lib/prospect/relay";

// ElevenLabs custom LLM endpoint (OpenAI Chat Completions shape). Authenticated with the
// relay secret ElevenLabs holds; prospect and conversation ids arrive as headers filled
// from dynamic variables.

export async function POST(request: Request) {
  boot();
  const secret = process.env.LLM_RELAY_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => null)) as ChatRequest | null;
  if (!body || !Array.isArray(body.messages)) return json({ error: "messages is required" }, 400);
  const stream = relayChat({
    body,
    prospectId: request.headers.get("x-prospect-id") || "",
    conversationId: request.headers.get("x-conversation-id") || "",
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
