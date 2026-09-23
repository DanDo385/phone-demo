import { googleConfigured } from "./status";

type TokenResponse = { access_token?: string; error?: string };

async function accessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error("Google token refresh failed");
  }
  return body.access_token;
}

export async function googleFreeBusy(start: Date, end: Date): Promise<{ ok: true; busy: Array<{ start: string; end: string }> } | { ok: false; error: string }> {
  if (!googleConfigured()) return { ok: true, busy: [] };
  try {
    const token = await accessToken();
    const calendarId = process.env.GOOGLE_CALENDAR_ID!;
    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calendarId }],
      }),
    });
    if (!response.ok) return { ok: false, error: `Google freeBusy returned ${response.status}` };
    const body = (await response.json()) as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> };
    return { ok: true, busy: body.calendars?.[calendarId]?.busy ?? [] };
  } catch {
    return { ok: false, error: "Google Calendar availability check failed" };
  }
}

export async function googleInsertEvent(input: {
  summary: string;
  description: string;
  start: string;
  end: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!googleConfigured()) return { ok: false, error: "Google Calendar is not configured" };
  try {
    const token = await accessToken();
    const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start, timeZone: "America/New_York" },
        end: { dateTime: input.end, timeZone: "America/New_York" },
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    if (!response.ok || !body.id) return { ok: false, error: `Google Calendar insert returned ${response.status}` };
    return { ok: true, id: body.id };
  } catch {
    return { ok: false, error: "Google Calendar insert failed" };
  }
}
