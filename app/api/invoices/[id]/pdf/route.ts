import fs from "node:fs";
import { get } from "@/lib/db";
import { currentOwner, json } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) return json({ error: "Sign in required" }, 401);
  const { id } = await context.params;
  const invoice = get<{ pdf_path: string; number: string }>("SELECT pdf_path, number FROM invoices WHERE id = ?", id);
  if (!invoice?.pdf_path || !fs.existsSync(invoice.pdf_path)) return json({ error: "Not found" }, 404);
  const bytes = fs.readFileSync(invoice.pdf_path);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
    },
  });
}
