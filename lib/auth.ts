import crypto from "node:crypto";
import { get, run } from "./db";
import { id, sha256 } from "./ids";
import { nowIso } from "./records";
import { verifyPassword } from "./seed";

const COOKIE = "palmetto_owner";

export function ownerCookieName(): string {
  return COOKIE;
}

export function login(email: string, password: string): { token: string } | null {
  const owner = get<{ id: string; password_hash: string }>("SELECT id, password_hash FROM owner_users WHERE email = ?", email.trim().toLowerCase());
  if (!owner || !verifyPassword(password, owner.password_hash)) return null;
  const raw = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  run("INSERT INTO owner_sessions(id, owner_id, token_hash, expires_at, created_at) VALUES(?, ?, ?, ?, ?)", id("os"), owner.id, sha256(raw), expires, nowIso());
  return { token: raw };
}

export function ownerFromToken(raw: string | undefined | null): { id: string; name: string; email: string } | null {
  if (!raw) return null;
  const row = get<{ id: string; name: string; email: string; expires_at: string }>(
    `SELECT u.id, u.name, u.email, s.expires_at FROM owner_sessions s JOIN owner_users u ON u.id = s.owner_id WHERE s.token_hash = ?`,
    sha256(raw),
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { id: row.id, name: row.name, email: row.email };
}

export function logout(raw: string | undefined): void {
  if (!raw) return;
  run("DELETE FROM owner_sessions WHERE token_hash = ?", sha256(raw));
}
