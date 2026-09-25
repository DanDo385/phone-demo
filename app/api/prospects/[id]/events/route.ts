import { boot } from "@/lib/http";
import { sweepIdleCalls } from "@/lib/prospect/pipeline";
import { prospectView } from "@/lib/prospect/view";

// Server-sent events: pushes the full view whenever it changes (analysis stages,
// transcript lines, bookings, summaries). The page renders straight from it.
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  boot();
  const pid = (await context.params).id;
  const enc = new TextEncoder();
  let last = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticks = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = () => {
        const view = prospectView(pid);
        if (!view) {
          controller.enqueue(enc.encode(`event: gone\ndata: {}\n\n`));
          clearInterval(timer);
          controller.close();
          return;
        }
        const data = JSON.stringify(view);
        if (data !== last) {
          last = data;
          controller.enqueue(enc.encode(`data: ${data}\n\n`));
        } else if (++ticks % 15 === 0) {
          controller.enqueue(enc.encode(`: keep-alive\n\n`));
        }
        if (ticks % 20 === 0) void sweepIdleCalls();
      };
      push();
      timer = setInterval(push, 700);
      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
