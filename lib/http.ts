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

// Caddy sets X-Forwarded-For from the real peer and strips client-sent CF-Connecting-IP
// (deploy/Caddyfile), so the first entry is the caller.
export function clientIp(request: Request): string {
  return (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function ownerGuard(): Promise<{ id: string; name: string; email: string } | NextResponse> {
  const owner = await currentOwner();
  if (!owner) return json({ error: "Sign in required" }, 401);
  return owner;
}
