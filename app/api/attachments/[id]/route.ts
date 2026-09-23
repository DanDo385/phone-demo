import fs from "node:fs";
import { get } from "@/lib/db";
import { currentOwner, json } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) return json({ error: "Sign in required" }, 401);
  const { id } = await context.params;
  const file = get<{ storage_path: string; content_type: string; filename: string }>(
    "SELECT storage_path, content_type, filename FROM attachments WHERE id = ?",
    id,
  );
  if (!file || !fs.existsSync(file.storage_path)) return json({ error: "Not found" }, 404);
  const bytes = fs.readFileSync(file.storage_path);
  return new Response(bytes, {
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
