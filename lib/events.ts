import { run } from "./db";
import { id } from "./ids";
import { nowIso } from "./records";

// Server side of lib/track.ts. Names are snake_case; props are flat scalars, capped in
// size, so the table cannot become a dumping ground for form contents.

const NAME = /^[a-z][a-z0-9_]{1,63}$/;
const MAX_PROPS_BYTES = 2000;

export function recordEvent(input: unknown): { ok: true } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid event" };
  const { name, props, anonymousId, path } = input as Record<string, unknown>;
  if (typeof name !== "string" || !NAME.test(name)) return { ok: false, error: "Invalid event name" };
  if (typeof anonymousId !== "string" || anonymousId.length > 64) return { ok: false, error: "Invalid id" };
  const flat: Record<string, string | number | boolean | null> = {};
  if (props && typeof props === "object") {
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) flat[key] = value as string | number | boolean | null;
    }
  }
  if (typeof path === "string") flat.path = path.slice(0, 200);
  const propsJson = JSON.stringify(flat);
  if (propsJson.length > MAX_PROPS_BYTES) return { ok: false, error: "Event too large" };
  run("INSERT INTO events(id, anonymous_id, prospect_id, name, props_json, created_at) VALUES (?, ?, NULL, ?, ?, ?)", id("evt"), anonymousId, name, propsJson, nowIso());
  return { ok: true };
}
