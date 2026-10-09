import { json } from "@/lib/http";
import { getDb } from "@/lib/db";
import { SHOWCASE } from "@/lib/ops/ids";
import { showcaseSnapshot } from "@/lib/ops/showcase";
import { attachMedia } from "@/lib/ops/workflow";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);

export async function POST(request: Request) {
  getDb();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a file." }, 400);
  if (!ALLOWED.has(file.type)) return json({ error: "Use a JPEG, PNG, WebP, PDF, or text file." }, 400);
  if (file.size > 8_000_000) return json({ error: "That file is larger than 8 MB." }, 400);
  const saved = attachMedia({
    businessId: SHOWCASE.roofing,
    inquiryId: SHOWCASE.inquiry,
    jobId: SHOWCASE.job,
    filename: file.name,
    mediaType: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
    permission: "job_documentation",
    actor: "examples",
  });
  if (!saved.ok) return json({ error: saved.error }, 400);
  return json({ id: saved.id, snapshot: showcaseSnapshot() });
}
