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

function recordingPath(callId: string): string {
  return path.join(path.dirname(databasePath()), "recordings", `${callId}.mp3`);
}

export function hasRecording(callId: string): boolean {
  return fs.existsSync(recordingPath(callId));
}

// Downloaded once and served from disk, so the browser gets byte ranges and can seek.
export async function saveRecording(callId: string, conversationId: string): Promise<boolean> {
  const h = headers();
  if (!h) return false;
  const response = await fetch(`${API}/${conversationId}/audio`, { headers: h, signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!response?.ok) return false;
  const file = recordingPath(callId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return true;
}

export function readRecording(callId: string): Buffer | null {
  const file = recordingPath(callId);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}
