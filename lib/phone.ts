// Twilio sends and expects E.164 (+17372583478). Configured numbers may be stored as
// 10-digit US numbers, so normalize before comparing or dialing.
export function toE164(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
}

export function sameNumber(a: string | undefined, b: string | undefined): boolean {
  const x = toE164(a);
  return Boolean(x) && x === toE164(b);
}
