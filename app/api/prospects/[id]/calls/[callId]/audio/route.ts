import { boot, json } from "@/lib/http";
import { readRecording } from "@/lib/prospect/conversation";
import { callById } from "@/lib/prospect/store";

// Serves the saved call recording with byte ranges so the player can seek.
export async function GET(request: Request, context: { params: Promise<{ id: string; callId: string }> }) {
  boot();
  const { id, callId } = await context.params;
  const call = callById(callId);
  if (!call || call.prospect_id !== id) return json({ error: "Not found" }, 404);
  const audio = readRecording(callId);
  if (!audio) return json({ error: "No recording" }, 404);
  const base = { "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) return new Response(new Uint8Array(audio), { headers: { ...base, "Content-Length": String(audio.length) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, audio.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), audio.length - 1) : audio.length - 1;
  if (start >= audio.length || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${audio.length}` } });
  return new Response(new Uint8Array(audio.subarray(start, end + 1)), {
    status: 206,
    headers: { ...base, "Content-Range": `bytes ${start}-${end}/${audio.length}`, "Content-Length": String(end - start + 1) },
  });
}
