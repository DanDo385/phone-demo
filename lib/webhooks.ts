import crypto from "node:crypto";

export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Twilio Voice webhook: HMAC-SHA1 of URL + sorted form fields, base64. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) data += key + params[key];
  return crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function verifyTwilioSignature(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  if (!input.signature) return false;
  const expected = twilioSignature(input.authToken, input.url, input.params);
  return timingSafeEqual(expected, input.signature);
}

/**
 * ElevenLabs-Signature: t=<unix>,v0=<hex>
 * HMAC-SHA256 of `${timestamp}.${rawBody}`. Multiple v0 values: any match is valid.
 * Reject timestamps older than 30 minutes.
 */
export function verifyElevenLabsSignature(input: {
  secret: string;
  rawBody: string;
  header: string | null;
  nowMs?: number;
}): boolean {
  if (!input.header) return false;
  const parts = input.header.split(",").map((p) => p.trim());
  const tsPart = parts.find((p) => p.startsWith("t="));
  if (!tsPart) return false;
  const timestamp = tsPart.slice(2);
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 30 * 60) return false;
  const expected = crypto.createHmac("sha256", input.secret).update(`${timestamp}.${input.rawBody}`).digest("hex");
  const provided = parts.filter((p) => p.startsWith("v0=")).map((p) => p.slice(3));
  return provided.some((sig) => timingSafeEqual(sig, expected));
}

/** AgentMail uses Svix. Signed content is `${id}.${timestamp}.${rawBody}`. Secret is whsec_ + base64. */
export function verifySvixSignature(input: {
  secret: string;
  rawBody: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  nowMs?: number;
}): boolean {
  if (!input.id || !input.timestamp || !input.signature) return false;
  const ts = Number(input.timestamp);
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60) return false;
  const material = input.secret.startsWith("whsec_") ? input.secret.slice("whsec_".length) : input.secret;
  const key = Buffer.from(material, "base64");
  const expected = crypto.createHmac("sha256", key).update(`${input.id}.${input.timestamp}.${input.rawBody}`).digest("base64");
  const candidates = input.signature.split(" ").map((part) => part.trim());
  return candidates.some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    return timingSafeEqual(value, expected);
  });
}
