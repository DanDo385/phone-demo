import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ownerCookieName, ownerFromToken } from "./auth";
import { getDb } from "./db";
import { ensureSeed } from "./seed";

let booted = false;

export function boot(): void {
  if (booted) return;
  getDb();
  ensureSeed();
  booted = true;
}

export async function currentOwner(): Promise<{ id: string; name: string; email: string } | null> {
  boot();
  const jar = await cookies();
  return ownerFromToken(jar.get(ownerCookieName())?.value);
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function ownerGuard(): Promise<{ id: string; name: string; email: string } | NextResponse> {
  const owner = await currentOwner();
  if (!owner) return json({ error: "Sign in required" }, 401);
  return owner;
}
