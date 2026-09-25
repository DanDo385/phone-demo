import Anthropic from "@anthropic-ai/sdk";
import { get, run } from "../db";
import { nowIso } from "../records";
import { voiceSystemPrompt } from "./prompt";
import { analysisOf, callForConversation, prospectById, replaceLines, type Line } from "./store";

// ElevenLabs "custom LLM" endpoint. ElevenLabs speaks OpenAI Chat Completions; this
// translates each turn to the Claude Messages API, streams the reply back as OpenAI
// chunks, and records the transcript so the prospect's page can show it live.

const MODEL = process.env.PROSPECT_VOICE_MODEL || "claude-opus-5";
// Callers may pick one of these per request (the self-hosted voice service does, for A/B tests).
const RELAY_MODELS = new Set(["claude-opus-5", "claude-sonnet-5", "claude-sonnet-5:fast", "claude-haiku-4-5"]);
// Voice turns need a fast first token more than deep reasoning.
const EFFORT = (process.env.PROSPECT_VOICE_EFFORT || "low") as "low" | "medium" | "high";

type OpenAIToolCall = { id: string; type?: "function"; function: { name: string; arguments: string } };
type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | Array<{ type: string; text?: string }> | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
};
type OpenAITool = { type: "function"; function: { name: string; description?: string; parameters?: Record<string, unknown> } };
export type ChatRequest = { model?: string; messages: OpenAIMessage[]; tools?: OpenAITool[]; stream?: boolean };

function textOf(content: OpenAIMessage["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content.map((part) => part.text ?? "").join("");
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

// Assistant turns that called tools are stored whole (thinking blocks included), keyed by
// tool_use id, so the next request can replay them exactly as Claude produced them.
function storedTurn(toolCalls: OpenAIToolCall[] | undefined): Anthropic.Beta.BetaContentBlockParam[] | null {
  const first = toolCalls?.[0]?.id;
  if (!first) return null;
  const row = get<{ content_json: string }>("SELECT content_json FROM relay_turns WHERE tool_use_id = ?", first);
  return row ? (JSON.parse(row.content_json) as Anthropic.Beta.BetaContentBlockParam[]) : null;
}

export function toClaudeMessages(messages: OpenAIMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  let pendingResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
  const flush = () => {
    if (pendingResults.length) out.push({ role: "user", content: pendingResults });
    pendingResults = [];
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      pendingResults.push({ type: "tool_result", tool_use_id: m.tool_call_id || "", content: textOf(m.content) || "(no result)" });
      continue;
    }
    flush();
    if (m.role === "user") {
      const text = textOf(m.content).trim();
      if (text) out.push({ role: "user", content: text });
      continue;
    }
    const stored = storedTurn(m.tool_calls);
    if (stored) {
      out.push({ role: "assistant", content: stored });
      continue;
    }
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
    const text = textOf(m.content).trim();
    if (text) blocks.push({ type: "text", text });
    for (const call of m.tool_calls ?? []) {
      blocks.push({ type: "tool_use", id: call.id, name: call.function.name, input: parseArgs(call.function.arguments) });
    }
    if (blocks.length) out.push({ role: "assistant", content: blocks });
  }
  flush();
  // The ElevenLabs greeting is an assistant turn with no user turn before it.
  if (out[0]?.role === "assistant") out.unshift({ role: "user", content: "(The call has connected.)" });
  if (!out.length) out.push({ role: "user", content: "(The call has connected.)" });
  return out;
}

function toClaudeTools(tools: OpenAITool[] | undefined): Anthropic.Beta.BetaTool[] {
  return (tools ?? []).map((t) => ({
    name: t.function.name,
    description: t.function.description || t.function.name,
    input_schema: (t.function.parameters as Anthropic.Beta.BetaTool.InputSchema) || { type: "object", properties: {} },
  }));
}

// ElevenLabs sends "..." as the caller's turn when they stayed silent.
export function isSilence(text: string): boolean {
  return /^[.…\s]*$/.test(text);
}

// Spoken lines: caller text and assistant text, in order. Tool plumbing and silence are not shown.
export function displayLines(messages: OpenAIMessage[]): Line[] {
  const lines: Line[] = [];
  for (const m of messages) {
    const text = textOf(m.content).trim();
    if (!text || isSilence(text)) continue;
    if (m.role === "user") lines.push({ speaker: "caller", text });
    if (m.role === "assistant") lines.push({ speaker: "agent", text });
  }
  return lines;
}

function chunk(id: string, delta: Record<string, unknown>, finish: string | null = null): string {
  return `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: MODEL,
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`;
}

function spokenStream(id: string, text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(chunk(id, { role: "assistant", content: text })));
      controller.enqueue(enc.encode(chunk(id, {}, "stop")));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export function relayChat(input: { body: ChatRequest; prospectId: string; conversationId: string }): ReadableStream<Uint8Array> {
  const completionId = `chatcmpl-${Date.now().toString(36)}`;
  const prospect = prospectById(input.prospectId);
  const analysis = analysisOf(prospect);
  if (!prospect || !analysis) {
    return spokenStream(
      completionId,
      "This demo line isn't set up for your business yet. Enter your website on the demo page, then call back. Goodbye.",
    );
  }

  const call = input.conversationId ? callForConversation(prospect.id, input.conversationId) : null;
  const history = call ? displayLines(input.body.messages) : [];
  if (call) replaceLines(call.id, history);

  const client = new Anthropic();
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(enc.encode(s));
      const toolIndex = new Map<number, number>();
      let spoken = "";
      try {
        send(chunk(completionId, { role: "assistant", content: "" }));
        const requested = RELAY_MODELS.has(input.body.model || "") ? input.body.model! : MODEL;
        // ":fast" runs the model with thinking off, for the quickest first word on a call.
        const fast = requested.endsWith(":fast");
        const model = requested.replace(/:fast$/, "");
        // Haiku 4.5 takes neither adaptive thinking nor effort; Opus and Fable get refusal fallbacks.
        const tuning = model.startsWith("claude-haiku")
          ? {}
          : fast
            ? { thinking: { type: "disabled" as const }, output_config: { effort: "low" as const } }
          : {
              thinking: { type: "adaptive" as const },
              output_config: { effort: EFFORT },
              ...(model.startsWith("claude-opus") || model.startsWith("claude-fable")
                ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
                : {}),
            };
        const stream = client.beta.messages.stream({
          model,
          max_tokens: 4096,
          ...tuning,
          system: [{ type: "text", text: voiceSystemPrompt(analysis), cache_control: { type: "ephemeral" } }],
          tools: toClaudeTools(input.body.tools),
          messages: toClaudeMessages(input.body.messages),
        });
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
            const n = toolIndex.size;
            toolIndex.set(event.index, n);
            send(
              chunk(completionId, {
                tool_calls: [{ index: n, id: event.content_block.id, type: "function", function: { name: event.content_block.name, arguments: "" } }],
              }),
            );
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            spoken += event.delta.text;
            send(chunk(completionId, { content: event.delta.text }));
          } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
            const n = toolIndex.get(event.index);
            if (n !== undefined) send(chunk(completionId, { tool_calls: [{ index: n, function: { arguments: event.delta.partial_json } }] }));
          }
        }
        const final = await stream.finalMessage();
        const toolUses = final.content.filter((b) => b.type === "tool_use");
        for (const block of toolUses) {
          run(
            "INSERT OR REPLACE INTO relay_turns(tool_use_id, conversation_id, content_json, created_at) VALUES(?, ?, ?, ?)",
            block.id,
            input.conversationId || "",
            JSON.stringify(final.content.filter((b) => b.type !== "fallback")),
            nowIso(),
          );
        }
        // Provisional: if ElevenLabs discards this reply, the next turn's history drops it again.
        if (call && spoken.trim()) replaceLines(call.id, [...history, { speaker: "agent", text: spoken.trim() }]);
        send(chunk(completionId, {}, toolUses.length && final.stop_reason === "tool_use" ? "tool_calls" : "stop"));
      } catch (error) {
        console.error("relay error", error instanceof Error ? error.message : error);
        if (!spoken) send(chunk(completionId, { content: "Sorry, I lost my train of thought. Could you say that again?" }));
        send(chunk(completionId, {}, "stop"));
      }
      send("data: [DONE]\n\n");
      controller.close();
    },
  });
}
