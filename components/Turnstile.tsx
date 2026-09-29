"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileState = { token: string; ready: boolean; reset: () => void; widget: React.ReactNode };

// Loads Cloudflare Turnstile only once `active` is true (the visitor started the form), so
// pages stay light. Without a configured site key it reports ready with no token and the
// server decides (skipped outside production, refused in production).
export function useTurnstile(active: boolean): TurnstileState {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || widgetId.current !== undefined) return;
    let cancelled = false;
    (async () => {
      const { siteKey } = (await fetch("/api/turnstile").then((r) => r.json()).catch(() => ({ siteKey: null }))) as { siteKey: string | null };
      if (cancelled) return;
      if (!siteKey) {
        setReady(true);
        return;
      }
      await loadScript().catch(() => undefined);
      if (cancelled || !window.turnstile || !box.current) return;
      widgetId.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        size: "flexible",
        callback: (t: string) => {
          setToken(t);
          setReady(true);
        },
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return {
    token,
    ready,
    reset: () => {
      setToken("");
      if (widgetId.current !== undefined) window.turnstile?.reset(widgetId.current);
    },
    widget: <div ref={box} className="turnstile-box" />,
  };
}
