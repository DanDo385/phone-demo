// A Turnstile check issues a short-lived grant. Autocomplete and lookup require it.
// The grant stores place ids from the latest match so confirm can only accept one of them.

import { get, run } from "../db";
import { token } from "../ids";
import { nowIso } from "../records";

const GRANT_MS = 20 * 60 * 1000;
export const GRANT_COOKIE = "place_grant";

export function issueGrant(ip: string): string {
  const grantId = token(24);
  const at = nowIso();
  const expires = new Date(Date.now() + GRANT_MS).toISOString();
  run("INSERT INTO place_grants(id, client_ip, place_ids_json, created_at, expires_at) VALUES (?, ?, '[]', ?, ?)", grantId, ip, at, expires);
  return grantId;
}

export function readGrant(grantId: string, ip: string): { placeIds: string[] } | null {
  if (!grantId) return null;
  const row = get<{ place_ids_json: string; expires_at: string; client_ip: string }>(
    "SELECT place_ids_json, expires_at, client_ip FROM place_grants WHERE id = ?",
    grantId,
  );
  if (!row || row.client_ip !== ip || row.expires_at < nowIso()) return null;
  const parsed = JSON.parse(row.place_ids_json) as unknown;
  const placeIds = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  return { placeIds };
}

export function rememberGrantPlaces(grantId: string, placeIds: string[]): void {
  run("UPDATE place_grants SET place_ids_json = ? WHERE id = ?", JSON.stringify(placeIds.slice(0, 5)), grantId);
}

export function grantCookie(grantId: string): string {
  const secure = process.env.APP_ENV === "production" ? "; Secure" : "";
  return `${GRANT_COOKIE}=${grantId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${GRANT_MS / 1000}${secure}`;
}

export function cookieValue(header: string | null, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
