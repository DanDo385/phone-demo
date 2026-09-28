import fs from "node:fs";
import path from "node:path";
import { run } from "@/lib/db";
import { boot, json } from "@/lib/http";
import { id } from "@/lib/ids";
import { addTimeline, lookupToken, nowIso } from "@/lib/records";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX = 5 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  boot();
  const { token } = await context.params;
  const access = lookupToken(token, "continuation");
  if (!access) return json({ error: "expired" }, 401);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "file required" }, 400);
  if (!ALLOWED.has(file.type)) return json({ error: "Only JPG, PNG, and WebP images are accepted" }, 400);
  if (file.size > MAX) return json({ error: "Images must be 5 MB or smaller" }, 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "data", "attachments", access.inquiry_id);
  fs.mkdirSync(dir, { recursive: true });
  const safe = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "") || "upload.jpg";
  const storage = path.join(dir, `${Date.now()}-${safe}`);
  fs.writeFileSync(storage, bytes);
  run(
    `INSERT INTO attachments(id, inquiry_id, filename, content_type, size_bytes, storage_path, caption, created_at, source_kind)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'simulated')`,
    id("att"),
    access.inquiry_id,
    safe,
    file.type,
    bytes.length,
    storage,
    "Customer upload. A photo does not confirm a diagnosis or a price. Fictional demo if this is sample data.",
    nowIso(),
  );
  addTimeline({
    inquiryId: access.inquiry_id,
    kind: "attachment",
    title: "Customer uploaded a photo",
    detail: "Local continuation page, not a provider callback",
    sourceKind: "simulated",
  });
  return json({ ok: true });
}
