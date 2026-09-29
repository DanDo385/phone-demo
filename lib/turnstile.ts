// Cloudflare Turnstile check for public forms that lead to paid calls or outbound mail.
// Without TURNSTILE_SECRET_KEY the check is skipped outside production and refused in
// production, so a missing key never silently opens a paid endpoint.

export type TurnstileResult = { ok: true; mode: "verified" | "skipped" } | { ok: false; error: string };

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY?.trim() || null;
}

export async function verifyTurnstile(token: unknown, ip: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.APP_ENV === "production") return { ok: false, error: "Verification is not configured. Try again later." };
    return { ok: true, mode: "skipped" };
  }
  if (typeof token !== "string" || !token) return { ok: false, error: "Please complete the verification." };
  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "local") form.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as { success?: boolean } | null;
  return body?.success ? { ok: true, mode: "verified" } : { ok: false, error: "Verification failed. Refresh the page and try again." };
}
