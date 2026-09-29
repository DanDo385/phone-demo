// Shared event tracking: track(name, props) from any client component. Events go to
// /api/events and land in the `events` table; forwarding to PostHog (POSTHOG_KEY) is not
// wired yet. Never put personal data (email, phone, names) in props.

export type TrackProps = Record<string, string | number | boolean | null>;

const ANON_KEY = "dcnt_anon";

function anonymousId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(ANON_KEY, created);
    return created;
  } catch {
    return "no-storage";
  }
}

export function track(name: string, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ name, props, anonymousId: anonymousId(), path: window.location.pathname });
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
  } catch {
    /* tracking never breaks the page */
  }
}
