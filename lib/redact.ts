const SECRET_KEYS = /token|secret|password|authorization|api[_-]?key|signature/i;

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.test(key) ? "[redacted]" : redactValue(inner, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return `${value.slice(0, 200)}…`;
  return value;
}

export function redactJson(value: unknown): string {
  return JSON.stringify(redactValue(value));
}
