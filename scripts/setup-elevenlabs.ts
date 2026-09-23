/**
 * Dry-run by default. Prints the demo agent payload and does not call ElevenLabs
 * unless --apply is passed together with ELEVENLABS_ALLOW_AGENT_CREATE=true
 * or ELEVENLABS_ALLOW_AGENT_UPDATE=true.
 *
 * An existing agent is updated only when its name is exactly
 * "Palmetto Coast Demo Receptionist".
 */
import fs from "node:fs";
import path from "node:path";

const TOOLS = [
  "save_customer_details",
  "lookup_service_info",
  "calculate_estimate",
  "send_continuation_link",
  "check_availability",
  "book_appointment",
  "request_human_followup",
];

function tool(name: string) {
  return {
    name: `palmetto_${name}`,
    description: `Palmetto Coast demo tool ${name}. Arguments and results stay in English field names in every spoken language.`,
    type: "webhook",
    api_schema: {
      url: `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/tools/${name}`,
      method: "POST",
      request_headers: { "x-tool-secret": { variable: "TOOL_WEBHOOK_SECRET" } },
    },
  };
}

export function agentPayload() {
  const prompt = fs.readFileSync(path.join(process.cwd(), "agent", "instructions.md"), "utf8");
  return {
    name: "Palmetto Coast Demo Receptionist",
    conversation_config: {
      agent: {
        language: "en",
        first_message:
          "Thanks for calling Palmetto Coast Home Services. I’m the AI assistant, and this call is transcribed. You can speak English or Spanish. Puede hablar en español.",
        prompt: {
          prompt,
          built_in_tools: {
            language_detection: {
              name: "language_detection",
              description:
                "Switch only between English (en) and Spanish (es). Switch when the caller is clearly speaking that language or explicitly asks to switch. Do not switch because of a name, a street, one borrowed word, or silence. If unsure, ask whether they prefer English or Spanish. If they ask for another language, say only English and Spanish are available and offer those or a human follow-up. Never start a new inquiry or repeat a tool call because the language changed.",
              params: { system_tool_type: "language_detection", only_at_conversation_start: false },
            },
          },
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
          },
        },
      },
      tts: {
        model_id: "eleven_turbo_v2_5",
        agent_output_audio_format: "ulaw_8000",
      },
      asr: { user_input_audio_format: "ulaw_8000" },
    },
    tools: TOOLS.map(tool),
  };
}

async function main() {
  const payload = agentPayload();
  const out = path.join(process.cwd(), "agent", "elevenlabs-agent.payload.json");
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log(`Dry run. Wrote ${out}. No ElevenLabs agent was created or changed.`);
    return;
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY is missing. Nothing was changed.");
    process.exit(1);
  }
  const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };
  if (process.env.ELEVENLABS_AGENT_ID) {
    if (process.env.ELEVENLABS_ALLOW_AGENT_UPDATE !== "true") {
      console.error("Refusing to update an existing agent. Set ELEVENLABS_ALLOW_AGENT_UPDATE=true only for the demo agent.");
      process.exit(1);
    }
    const current = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`, { headers });
    const body = (await current.json()) as { name?: string };
    if (body.name !== "Palmetto Coast Demo Receptionist") {
      console.error("Refusing to update an agent whose name is not Palmetto Coast Demo Receptionist.");
      process.exit(1);
    }
    const updated = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    console.log(`Update status ${updated.status}`);
    if (!updated.ok) process.exit(1);
    return;
  }
  if (process.env.ELEVENLABS_ALLOW_AGENT_CREATE !== "true") {
    console.error("Refusing to create an agent. Set ELEVENLABS_ALLOW_AGENT_CREATE=true to create the demo agent.");
    process.exit(1);
  }
  const created = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await created.text();
  console.log(created.status, text.slice(0, 300));
  if (!created.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "setup failed");
  process.exit(1);
});
