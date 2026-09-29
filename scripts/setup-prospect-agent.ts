/**
 * Creates or updates the ElevenLabs agent for the prospect demo. Its turns come from
 * this app's custom LLM relay (/api/llm/v1), which injects each prospect's script.
 *
 *   project-env npm run setup:prospect-agent            # dry run, writes the payload
 *   project-env npm run setup:prospect-agent -- --apply # create or update
 *
 * Requires APP_BASE_URL (public https), LLM_RELAY_SECRET and TOOL_WEBHOOK_SECRET.
 * A new agent id is saved to the ElevenLabs item (prospect_agent_id); paste it into
 * ELEVENLABS_PROSPECT_AGENT_ID in the phone-demo-dev Environment.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const API = "https://api.elevenlabs.io/v1/convai";
const AGENT_NAME = "Receptionist Demo (prospects)";
const RELAY_MODEL = process.env.PROSPECT_VOICE_MODEL || "claude-opus-5";
const OP_ELEVENLABS_ITEM = process.env.ELEVENLABS_OP_ITEM || "lepwetmvclv3h6qamwbxdzwm6u";

type Prop = { type: "string"; description?: string; dynamic_variable?: string };

const common: Record<string, Prop> = {
  prospect_id: { type: "string", dynamic_variable: "prospect_id" },
  conversation_id: { type: "string", dynamic_variable: "system__conversation_id" },
};

const TOOLS: Record<string, { description: string; properties: Record<string, Prop>; required: string[] }> = {
  check_availability: {
    description: "List open appointment times. Call before offering any time.",
    properties: {},
    required: [],
  },
  book_appointment: {
    description: "Book one of the open times returned by check_availability. Confirm to the caller only if this succeeds.",
    properties: {
      starts_at: { type: "string", description: "The starts_at value exactly as check_availability returned it" },
      service: { type: "string", description: "Service name from the business profile" },
      customer_name: { type: "string", description: "Caller's name" },
      customer_phone: { type: "string", description: "Callback number" },
      notes: { type: "string", description: "Short description of the job" },
    },
    required: ["starts_at", "service", "customer_name"],
  },
  take_message: {
    description: "Take a message for the team when the caller needs a person or something you cannot answer.",
    properties: {
      message: { type: "string", description: "The message, in English" },
      customer_name: { type: "string", description: "Caller's name" },
      customer_phone: { type: "string", description: "Callback number" },
    },
    required: ["message"],
  },
};

function base(): string {
  return (process.env.APP_BASE_URL || "").replace(/\/$/, "");
}

function tool(name: string, toolSecretId: string) {
  const def = TOOLS[name];
  return {
    type: "webhook",
    name,
    description: def.description,
    api_schema: {
      url: `${base()}/api/prospect-tools/${name}`,
      method: "POST",
      request_headers: { "x-tool-secret": { secret_id: toolSecretId } },
      request_body_schema: {
        type: "object",
        properties: { ...common, ...def.properties },
        required: ["prospect_id", "conversation_id", ...def.required],
      },
    },
  };
}

export function payload(toolSecretId = "TOOL_SECRET_SET_ON_APPLY", relaySecretId = "RELAY_SECRET_SET_ON_APPLY") {
  return {
    name: AGENT_NAME,
    tags: ["demo", "prospect"],
    conversation_config: {
      agent: {
        language: "en",
        first_message: "{{first_message}}",
        dynamic_variables: {
          dynamic_variable_placeholders: {
            prospect_id: "none",
            business_name: "the business",
            first_message: "Thanks for calling. I'm the AI receptionist demo. How can I help?",
          },
        },
        prompt: {
          // The relay replaces this with the prospect's full script on every turn.
          prompt: "You are the AI phone receptionist for {{business_name}}.",
          llm: "custom-llm",
          custom_llm: {
            url: `${base()}/api/llm/v1`,
            model_id: RELAY_MODEL,
            api_key: { secret_id: relaySecretId },
            request_headers: {
              "x-prospect-id": { variable_name: "prospect_id" },
              "x-conversation-id": { variable_name: "system__conversation_id" },
            },
          },
          tools: [
            ...Object.keys(TOOLS).map((name) => tool(name, toolSecretId)),
            // System tools go in the tools list; ElevenLabs ignores a built_in_tools block on create.
            { type: "system", name: "end_call", description: "Hang up after the caller says goodbye, or after they stay silent.", params: { system_tool_type: "end_call" } },
            {
              type: "system",
              name: "language_detection",
              description: "Switch between English (en) and Spanish (es) only when the caller clearly speaks that language or asks.",
              params: { system_tool_type: "language_detection", only_at_conversation_start: false },
            },
          ],
        },
      },
      language_presets: {
        es: { overrides: { agent: { language: "es" }, tts: { model_id: "eleven_flash_v2_5" } } },
      },
      tts: { model_id: "eleven_flash_v2", agent_output_audio_format: "ulaw_8000" },
      asr: { user_input_audio_format: "ulaw_8000" },
    },
  };
}

async function ensureSecret(headers: Record<string, string>, name: string, value: string | undefined): Promise<string> {
  if (!value) throw new Error(`The value for ${name} is missing. Nothing was changed.`);
  const list = (await (await fetch(`${API}/secrets`, { headers })).json()) as { secrets?: Array<{ name: string; secret_id: string }> };
  const existing = list.secrets?.find((s) => s.name === name);
  if (existing) return existing.secret_id;
  const created = await fetch(`${API}/secrets`, { method: "POST", headers, body: JSON.stringify({ type: "new", name, value }) });
  const body = (await created.json()) as { secret_id?: string };
  if (!created.ok || !body.secret_id) throw new Error(`Creating secret ${name} returned ${created.status}`);
  console.log(`Stored ${name} in ElevenLabs.`);
  return body.secret_id;
}

async function main() {
  const out = path.join(process.cwd(), "agent", "prospect-agent.payload.json");
  if (!process.argv.includes("--apply")) {
    fs.writeFileSync(out, JSON.stringify(payload(), null, 2));
    console.log(`Dry run. Wrote ${out}. No ElevenLabs agent was created or changed.`);
    return;
  }
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is missing. Nothing was changed.");
  if (!/^https:\/\//.test(base())) throw new Error("APP_BASE_URL must be the public https URL. Nothing was changed.");
  const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };
  const toolSecret = await ensureSecret(headers, "palmetto_tool_webhook_secret", process.env.TOOL_WEBHOOK_SECRET);
  const relaySecret = await ensureSecret(headers, "prospect_llm_relay_secret", process.env.LLM_RELAY_SECRET);
  const body = payload(toolSecret, relaySecret);
  fs.writeFileSync(out, JSON.stringify(body, null, 2));

  let agentId = process.env.ELEVENLABS_PROSPECT_AGENT_ID || "";
  if (!agentId) {
    const list = (await (await fetch(`${API}/agents?search=${encodeURIComponent(AGENT_NAME)}`, { headers })).json()) as {
      agents?: Array<{ agent_id: string; name: string }>;
    };
    agentId = list.agents?.find((a) => a.name === AGENT_NAME)?.agent_id ?? "";
  }
  const response = await fetch(agentId ? `${API}/agents/${agentId}` : `${API}/agents/create`, {
    method: agentId ? "PATCH" : "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${agentId ? "Update" : "Create"} returned ${response.status}: ${text.slice(0, 800)}`);
  if (agentId) {
    console.log(`Updated ${AGENT_NAME} (${agentId}).`);
    return;
  }
  agentId = (JSON.parse(text) as { agent_id: string }).agent_id;
  console.log(`Created ${AGENT_NAME} (${agentId}).`);
  try {
    execFileSync("op", ["item", "edit", OP_ELEVENLABS_ITEM, "--vault", "Dev", `prospect_agent_id[text]=${agentId}`], { stdio: ["ignore", "ignore", "inherit"] });
    console.log("Saved prospect_agent_id to the ElevenLabs item in 1Password.");
  } catch {
    console.error("Could not save prospect_agent_id to 1Password. Add it by hand.");
  }
  console.log(`Paste ${agentId} into ELEVENLABS_PROSPECT_AGENT_ID in the phone-demo-dev Environment.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "setup failed");
  process.exit(1);
});
