import fs from "node:fs";
import path from "node:path";
import { get, run } from "./db";
import { id } from "./ids";
import { addTimeline, addTurn, inquiryById, nowIso, setDemoOffset } from "./records";
import { customerTurn, endSession, openConversation } from "./turn";
import type { LanguageMode } from "./types";

type Line = { text: string; en?: string };

const SCRIPTS: Record<"en" | "es" | "switch", { mode: LanguageMode; lines: Line[] }> = {
  en: {
    mode: "en",
    lines: [
      { text: "Hi, the shutoff valve under my kitchen sink is leaking. Can someone come tomorrow?" },
      { text: "Jordan Hale" },
      { text: "772-555-0148" },
      { text: "jordan.hale@example.com" },
      { text: "1842 SW Palmetto Trace, Port St. Lucie, Florida" },
      { text: "Yes, that's correct." },
      { text: "Yes, please email me a link so I can upload a photo." },
      { text: "Please book the earliest morning appointment tomorrow." },
    ],
  },
  es: {
    mode: "es",
    lines: [
      {
        text: "Hola, tengo una fuga debajo del fregadero de la cocina. ¿Pueden venir mañana? Prefiero hablar en español.",
        en: "Hi, I have a leak under the kitchen sink. Can you come tomorrow? I prefer Spanish.",
      },
      { text: "Elena Varga", en: "Elena Varga" },
      { text: "772-555-0194", en: "772-555-0194" },
      { text: "elena.varga@example.com", en: "elena.varga@example.com" },
      { text: "910 SW Tradition Parkway, Tradition, Florida", en: "910 SW Tradition Parkway, Tradition, Florida" },
      { text: "Sí, es correcto.", en: "Yes, that is correct." },
      { text: "Sí, por favor envíeme un enlace para subir una foto.", en: "Yes, please email me a link so I can upload a photo." },
      { text: "Reserve la primera hora de la mañana.", en: "Book the earliest morning appointment." },
    ],
  },
  switch: {
    mode: "auto",
    lines: [
      { text: "Hi, the shutoff valve under my kitchen sink is leaking." },
      { text: "Jordan Hale" },
      { text: "Español, por favor", en: "Spanish, please" },
      { text: "772-555-0148", en: "772-555-0148" },
      { text: "jordan.hale@example.com", en: "jordan.hale@example.com" },
      { text: "1842 SW Palmetto Trace, Port St. Lucie, Florida", en: "1842 SW Palmetto Trace, Port St. Lucie, Florida" },
      { text: "Sí, es correcto.", en: "Yes, that is correct." },
      { text: "Sí, envíeme el enlace.", en: "Yes, send me the link." },
      { text: "Can we continue in English?" },
      { text: "Please book the earliest morning appointment tomorrow." },
    ],
  },
};

export async function runScenario(scenario: "en" | "es" | "switch"): Promise<string> {
  setDemoOffset(0);
  const script = SCRIPTS[scenario];
  const opened = openConversation({
    origin: "simulated_replay",
    mode: script.mode,
    channel: "replay",
    provider: "simulated",
    sourceKind: "simulated_replay",
    voiceId: "avery",
  });
  addTimeline({
    inquiryId: opened.inquiryId,
    kind: "incoming_call",
    title: "Incoming call",
    detail: "Simulated carrier event",
    sourceKind: "simulated_replay",
  });
  addTimeline({
    inquiryId: opened.inquiryId,
    kind: "owner_ringing",
    title: "Owner phone ringing",
    detail: "Alex Rivera did not answer",
    sourceKind: "simulated_replay",
  });
  addTimeline({
    inquiryId: opened.inquiryId,
    kind: "no_answer",
    title: "No answer",
    detail: "Forwarding to the AI receptionist",
    sourceKind: "simulated_replay",
  });
  addTimeline({
    inquiryId: opened.inquiryId,
    kind: "forwarded",
    title: "Forwarded to AI receptionist",
    detail: "Simulated replay, not a live carrier call",
    sourceKind: "simulated_replay",
  });
  for (const line of script.lines) {
    await customerTurn(opened.inquiryId, line.text, "simulated_replay", line.en);
  }
  endSession(opened.inquiryId);
  addTimeline({
    inquiryId: opened.inquiryId,
    kind: "call_completed",
    title: "Call completed",
    sourceKind: "simulated_replay",
  });
  addTimeline({
    inquiryId: opened.inquiryId,
    kind: "link_opened",
    title: "Customer opened the continuation link",
    sourceKind: "simulated_replay",
  });
  attachSamplePhoto(opened.inquiryId);
  return opened.inquiryId;
}

function attachSamplePhoto(inquiryId: string): void {
  const source = path.join(process.cwd(), "assets", "sample-undersink.jpg");
  if (!fs.existsSync(source)) return;
  const dir = path.join(process.cwd(), "data", "attachments", inquiryId);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "sample-undersink.jpg");
  fs.copyFileSync(source, target);
  const size = fs.statSync(target).size;
  run(
    `INSERT INTO attachments(id, inquiry_id, filename, content_type, size_bytes, storage_path, caption, created_at, source_kind)
     VALUES(?, ?, 'sample-undersink.jpg', 'image/jpeg', ?, ?, ?, ?, 'simulated_replay')`,
    id("att"),
    inquiryId,
    size,
    target,
    "FICTIONAL DEMO PHOTO — not a customer home and not a diagnosis.",
    nowIso(),
  );
  const inquiry = inquiryById(inquiryId);
  const spanish = inquiry?.preferred_language === "es";
  addTurn({
    inquiryId,
    sessionId: active(inquiryId),
    speaker: "caller",
    text: spanish ? "Subí una foto de la válvula bajo el fregadero." : "I uploaded a photo of the under-sink valve.",
    language: spanish ? "es" : "en",
    sourceKind: "simulated_replay",
    translation: spanish
      ? { text: "I uploaded a photo of the under-sink valve.", status: "generated", source: "authored_pair" }
      : undefined,
  });
  addTimeline({
    inquiryId,
    kind: "attachment",
    title: "Photo uploaded",
    detail: "Fictional demo photo",
    sourceKind: "simulated_replay",
  });
}

function active(inquiryId: string): string {
  const row = get<{ id: string }>("SELECT id FROM sessions WHERE inquiry_id = ? ORDER BY started_at DESC LIMIT 1", inquiryId);
  if (!row) throw new Error("missing session");
  return row.id;
}
