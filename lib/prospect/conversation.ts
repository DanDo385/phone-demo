import fs from "node:fs";
import path from "node:path";
import { databasePath } from "../db";
import { isSilence } from "./relay";
import type { Line } from "./store";

// After a call, ElevenLabs holds the authoritative transcript (with timings) and the audio.

const API = "https://api.elevenlabs.io/v1/convai/conversations";

type Turn = { role: "agent" | "user"; message?: string | null; time_in_call_secs?: number };

function headers(): Record<string, string> | null {
  const key = process.env.ELEVENLABS_API_KEY;
  return key ? { "xi-api-key": key } : null;
}

// Waits for ElevenLabs to finish processing (usually a few seconds after hang-up).
export async function finalTranscript(conversationId: string, waitMs = 20_000): Promise<Line[] | null> {
  const h = headers();
  if (!h) return null;
  const until = Date.now() + waitMs;
  while (true) {
    const response = await fetch(`${API}/${conversationId}`, { headers: h, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const body = response?.ok ? ((await response.json()) as { status?: string; transcript?: Turn[] }) : null;
    if (body && (body.status === "done" || body.status === "failed" || Date.now() > until)) {
      const lines: Line[] = [];
      for (const turn of body.transcript ?? []) {
        const text = (turn.message ?? "").trim();
        if (!text || isSilence(text)) continue;
        lines.push({ speaker: turn.role === "agent" ? "agent" : "caller", text, atSecs: turn.time_in_call_secs });
      }
      return lines.length ? lines : null;
    }
    if (!body && Date.now() > until) return null;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const TYPES = { mp3: "audio/mpeg", wav: "audio/wav" } as const;
type Ext = keyof typeof TYPES;

function recordingPath(callId: string, ext: Ext): string {
  return path.join(path.dirname(databasePath()), "recordings", `${callId}.${ext}`);
}

function existing(callId: string): { file: string; type: string } | null {
  for (const ext of Object.keys(TYPES) as Ext[]) {
    const file = recordingPath(callId, ext);
    if (fs.existsSync(file)) return { file, type: TYPES[ext] };
  }
  return null;
}

export function hasRecording(callId: string): boolean {
  return existing(callId) !== null;
}

export function storeRecording(callId: string, audio: Buffer, ext: Ext): void {
  const file = recordingPath(callId, ext);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, audio);
}

// Downloaded once and served from disk, so the browser gets byte ranges and can seek.
export async function saveRecording(callId: string, conversationId: string): Promise<boolean> {
  const h = headers();
  if (!h) return false;
  const response = await fetch(`${API}/${conversationId}/audio`, { headers: h, signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!response?.ok) return false;
  storeRecording(callId, Buffer.from(await response.arrayBuffer()), "mp3");
  return true;
}

export function readRecording(callId: string): { audio: Buffer; type: string } | null {
  const found = existing(callId);
  return found ? { audio: fs.readFileSync(found.file), type: found.type } : null;
}

// Conversations run by the self-hosted voice service (voice/) use this prefix; ElevenLabs
// has nothing for them, and the service uploads its own transcript and recording.
export function isSelfHosted(conversationId: string | null): boolean {
  return Boolean(conversationId?.startsWith("self_"));
}
