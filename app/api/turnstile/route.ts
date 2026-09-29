import { json } from "@/lib/http";
import { turnstileSiteKey } from "@/lib/turnstile";

// The site key is public, but it lives in the 1Password Environment like everything else.
// Serving it at runtime keeps the marketing pages static.
export function GET() {
  return json({ siteKey: turnstileSiteKey() });
}
