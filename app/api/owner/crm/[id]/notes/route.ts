import { NextResponse } from "next/server";
import { ownerGuard } from "@/lib/http";
import { addNote } from "@/lib/scoring";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await ownerGuard();
  if (owner instanceof Response) return owner;
  const { id } = await context.params;
  const form = await request.formData();
  const body = String(form.get("body") || "");
  try {
    addNote(id, owner.name, body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Note failed" }, { status: 400 });
  }
  return NextResponse.redirect(new URL(`/dashboard/crm/${id}`, request.url), 303);
}
