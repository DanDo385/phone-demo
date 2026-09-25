import { toE164 } from "../phone";

// Show the demo number only when Twilio says the account owns it. Cached for ten minutes;
// the page renders from the last known answer and refreshes in the background.
let cache: { number: string; owned: boolean; at: number } | null = null;
let inflight = false;

async function refresh(number: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || inflight) return;
  inflight = true;
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      signal: AbortSignal.timeout(8000),
    });
    const body = (await response.json()) as { incoming_phone_numbers?: unknown[] };
    cache = { number, owned: response.ok && (body.incoming_phone_numbers?.length ?? 0) > 0, at: Date.now() };
  } catch {
    cache = { number, owned: cache?.owned ?? false, at: Date.now() };
  } finally {
    inflight = false;
  }
}

export function demoLineOwned(): string | null {
  const number = toE164(process.env.TWILIO_PHONE_NUMBER);
  if (!number) return null;
  if (!cache || cache.number !== number || Date.now() - cache.at > 10 * 60_000) void refresh(number);
  return cache?.number === number && cache.owned ? number : null;
}
