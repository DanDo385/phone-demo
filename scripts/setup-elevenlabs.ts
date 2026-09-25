/**
 * Dry-run by default. Prints the demo agent payload and does not call ElevenLabs
 * unless --apply is passed together with ELEVENLABS_ALLOW_AGENT_CREATE=true
 * or ELEVENLABS_ALLOW_AGENT_UPDATE=true. The Environment sets both to false, so
 * override inside the injected environment:
 *
 *   project-env npm run setup:elevenlabs
 *   project-env env ELEVENLABS_ALLOW_AGENT_CREATE=true npm run setup:elevenlabs -- --apply
 *
 * An existing agent is updated only when its name is exactly
 * "Palmetto Coast Demo Receptionist". A new agent's id is saved to the canonical
 * ElevenLabs item; paste it into ELEVENLABS_AGENT_ID in the phone-demo-dev Environment.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SERVICES } from "../lib/business";

const AGENT_NAME = "Palmetto Coast Demo Receptionist";
const SECRET_NAME = "palmetto_tool_webhook_secret";
// Latency matters more than depth on a phone call. Override with ELEVENLABS_LLM.
const LLM = process.env.ELEVENLABS_LLM || "claude-haiku-4-5";
const OP_ELEVENLABS_ITEM = process.env.ELEVENLABS_OP_ITEM || "lepwetmvclv3h6qamwbxdzwm6u";

type Prop = { type: "string"; description: string; enum?: string[] };

const serviceCode: Prop = {
  type: "string",
  description: "Service code from the catalog. Use the code, not the spoken name.",
  enum: SERVICES.map((s) => s.code),
};

// Field names match lib/tools.ts. inquiry_id is filled by ElevenLabs from the
// dynamic variable set in register-call (telephone) or startSession (browser).
const TOOLS: Record<string, { description: string; properties: Record<string, Prop>; required: string[] }> = {
  save_customer_details: {
    description: "Save what the caller has told you. Call whenever you learn a new detail. Send only fields you heard.",
    properties: {
      name: { type: "string", description: "Caller's full name" },
      phone: { type: "string", description: "Callback number" },
      email: { type: "string", description: "Email address, spelled back and confirmed" },
      address: { type: "string", description: "Service address including city" },
      issue: { type: "string", description: "Short English summary of the problem" },
      service_code: serviceCode,
      preferred_language: { type: "string", description: "Language the caller prefers", enum: ["en", "es"] },
    },
    required: [],
  },
  lookup_service_info: {
    description: "Look up what a service includes, its assumptions, and its demo price before describing it.",
    properties: { service_code: serviceCode },
    required: ["service_code"],
  },
  calculate_estimate: {
    description: "Get the demo estimate for a service. Quote only the figures this returns.",
    properties: { service_code: serviceCode },
    required: ["service_code"],
  },
  send_continuation_link: {
    description: "Email the caller a link to upload photos or finish later. The call continues.",
    properties: { email: { type: "string", description: "Confirmed email address" } },
    required: ["email"],
  },
  check_availability: {
    description: "List open appointment slots for a service. Offer only slots this returns.",
    properties: { service_code: serviceCode },
    required: ["service_code"],
  },
  book_appointment: {
    description: "Book a slot returned by check_availability. Announce the time only if this succeeds.",
    properties: {
      starts_at: { type: "string", description: "The slot's start value exactly as check_availability returned it (ISO 8601)" },
      service_code: serviceCode,
    },
    required: ["starts_at", "service_code"],
  },
  request_human_followup: {
    description: "Ask the office to call back when you cannot help or the caller asks for a person.",
    properties: { reason: { type: "string", description: "Short English reason" } },
    required: ["reason"],
  },
};

function tool(name: string, secretId: string) {
  const def = TOOLS[name];
  return {
    type: "webhook",
    name,
    description: `${def.description} Arguments stay in English field names in every spoken language.`,
    api_schema: {
      url: `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/tools/${name}`,
      method: "POST",
      request_headers: { "x-tool-secret": { secret_id: secretId } },
      request_body_schema: {
        type: "object",
        properties: {
          inquiry_id: { type: "string", dynamic_variable: "inquiry_id" },
          ...def.properties,
        },
        required: ["inquiry_id", ...def.required],
      },
    },
  };
}

export function agentPayload(secretId = "SECRET_ID_SET_ON_APPLY") {
  const prompt = fs.readFileSync(path.join(process.cwd(), "agent", "instructions.md"), "utf8");
  return {
    name: AGENT_NAME,
    tags: ["demo", "palmetto-coast"],
    conversation_config: {
      agent: {
        language: "en",
        // Placeholders only apply when a caller supplies nothing, such as a dashboard test call.
        dynamic_variables: { dynamic_variable_placeholders: { inquiry_id: "dashboard-test", preferred_language: "en" } },
        first_message:
          "Thanks for calling Palmetto Coast Home Services. I’m the AI assistant, and this call is transcribed. You can speak English or Spanish. Puede hablar en español.",
        prompt: {
          prompt,
          llm: LLM,
          tools: [
            ...Object.keys(TOOLS).map((name) => tool(name, secretId)),
            // System tools go in the tools list; ElevenLabs ignores a built_in_tools block.
            { type: "system", name: "end_call", description: "Hang up after the caller says goodbye.", params: { system_tool_type: "end_call" } },
            {
              type: "system",
              name: "language_detection",
              description:
                "Switch only between English (en) and Spanish (es). Switch when the caller is clearly speaking that language or explicitly asks to switch. Do not switch because of a name, a street, one borrowed word, or silence. If unsure, ask whether they prefer English or Spanish.",
              params: { system_tool_type: "language_detection", only_at_conversation_start: false },
            },
          ],
        },
      },
      language_presets: {
        es: {
          overrides: {
            agent: {
              first_message:
                "Gracias por llamar a Palmetto Coast Home Services. Soy el asistente de inteligencia artificial y esta llamada se transcribe. Puedo ayudarle en español.",
              language: "es",
            },
            // English agents must use a v2 English model; Spanish needs the multilingual v2.5 model.
            tts: { model_id: "eleven_flash_v2_5" },
          },
        },
      },
      tts: {
        model_id: "eleven_flash_v2",
        agent_output_audio_format: "ulaw_8000",
      },
      asr: { user_input_audio_format: "ulaw_8000" },
    },
  };
}

const API = "https://api.elevenlabs.io/v1/convai";

async function ensureToolSecret(headers: Record<string, string>): Promise<string> {
  const value = process.env.TOOL_WEBHOOK_SECRET;
  if (!value) throw new Error("TOOL_WEBHOOK_SECRET is missing. Nothing was changed.");
  const list = (await (await fetch(`${API}/secrets`, { headers })).json()) as { secrets?: Array<{ name: string; secret_id: string }> };
  const existing = list.secrets?.find((s) => s.name === SECRET_NAME);
  if (existing) return existing.secret_id;
  const created = await fetch(`${API}/secrets`, { method: "POST", headers, body: JSON.stringify({ type: "new", name: SECRET_NAME, value }) });
  const body = (await created.json()) as { secret_id?: string };
  if (!created.ok || !body.secret_id) throw new Error(`Creating the tool secret returned ${created.status}`);
  console.log(`Stored TOOL_WEBHOOK_SECRET in ElevenLabs as ${SECRET_NAME}.`);
  return body.secret_id;
}

function saveAgentId(agentId: string) {
  try {
    execFileSync("op", ["item", "edit", OP_ELEVENLABS_ITEM, "--vault", "Dev", `agent_id[text]=${agentId}`], { stdio: ["ignore", "ignore", "inherit"] });
    console.log("Saved agent_id to the ElevenLabs item in 1Password.");
  } catch {
    console.error("Could not save agent_id to 1Password. Add it by hand.");
  }
  console.log(`Paste ${agentId} into ELEVENLABS_AGENT_ID in the phone-demo-dev Environment (1Password > Developer > Environments).`);
}

async function main() {
  const out = path.join(process.cwd(), "agent", "elevenlabs-agent.payload.json");
  const apply = process.argv.includes("--apply");
  if (!apply) {
    fs.writeFileSync(out, JSON.stringify(agentPayload(), null, 2));
    console.log(`Dry run. Wrote ${out}. No ElevenLabs agent was created or changed.`);
    return;
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY is missing. Nothing was changed.");
    process.exit(1);
  }
  if (!/^https:\/\//.test(process.env.APP_BASE_URL || "")) {
    console.error("APP_BASE_URL must be the public https URL. ElevenLabs cannot reach localhost tool webhooks. Nothing was changed.");
    process.exit(1);
  }
  const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };
  let agentId = process.env.ELEVENLABS_AGENT_ID || "";
  if (!agentId) {
    // The Environment is updated by hand, so a created agent may not be in it yet. Never create a duplicate.
    const list = (await (await fetch(`${API}/agents?search=${encodeURIComponent(AGENT_NAME)}`, { headers })).json()) as {
      agents?: Array<{ agent_id: string; name: string }>;
    };
    const found = list.agents?.find((a) => a.name === AGENT_NAME);
    if (found) {
      console.error(`${AGENT_NAME} already exists (${found.agent_id}). Set ELEVENLABS_AGENT_ID and run with ELEVENLABS_ALLOW_AGENT_UPDATE=true.`);
      process.exit(1);
    }
  }
  if (agentId) {
    if (process.env.ELEVENLABS_ALLOW_AGENT_UPDATE !== "true") {
      console.error("Refusing to update an existing agent. Set ELEVENLABS_ALLOW_AGENT_UPDATE=true only for the demo agent.");
      process.exit(1);
    }
    const current = await fetch(`${API}/agents/${agentId}`, { headers });
    const body = (await current.json()) as { name?: string };
    if (body.name !== AGENT_NAME) {
      console.error(`Refusing to update an agent whose name is not ${AGENT_NAME}.`);
      process.exit(1);
    }
  } else if (process.env.ELEVENLABS_ALLOW_AGENT_CREATE !== "true") {
    console.error("Refusing to create an agent. Set ELEVENLABS_ALLOW_AGENT_CREATE=true to create the demo agent.");
    process.exit(1);
  }
  const payload = agentPayload(await ensureToolSecret(headers));
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  const response = await fetch(agentId ? `${API}/agents/${agentId}` : `${API}/agents/create`, {
    method: agentId ? "PATCH" : "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`${agentId ? "Update" : "Create"} returned ${response.status}: ${text.slice(0, 600)}`);
    process.exit(1);
  }
  if (agentId) {
    console.log(`Updated ${AGENT_NAME} (${agentId}).`);
    return;
  }
  agentId = (JSON.parse(text) as { agent_id: string }).agent_id;
  console.log(`Created ${AGENT_NAME} (${agentId}).`);
  saveAgentId(agentId);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "setup failed");
  process.exit(1);
});
