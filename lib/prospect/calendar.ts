import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { sha256 } from "../ids";
import type { Analysis } from "./schema";
import { bookingsFor } from "./store";

// A believable mock calendar per prospect: their stated hours, about a third of the
// slots already taken (deterministic per prospect so the page and the call agree),
// and anything booked during a demo call.

export type MockSlot = { start: string; end: string; label: string; status: "open" | "busy" | "booked"; bookedFor?: string };

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAYS_AHEAD = 7;
// Phone hours can run 5 AM to 11 PM; appointments stay within a normal working day.
const APPT_OPEN = 7 * 60;
const APPT_CLOSE = 19 * 60;

function parseClock(value: string): number | null {
  const m = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  if (m[3]?.startsWith("p") && hour < 12) hour += 12;
  if (m[3]?.startsWith("a") && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function dayIndexes(days: string): number[] {
  const text = days.toLowerCase();
  if (/daily|every day|7 days/.test(text)) return [0, 1, 2, 3, 4, 5, 6];
  if (/weekday/.test(text)) return [1, 2, 3, 4, 5];
  const found = DAY_NAMES.map((d, i) => (text.includes(d) ? i : -1)).filter((i) => i >= 0);
  const range = text.match(/(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*(?:-|–|—|to|through)\s*(sun|mon|tue|wed|thu|fri|sat)/);
  if (range) {
    const a = DAY_NAMES.indexOf(range[1]);
    const b = DAY_NAMES.indexOf(range[2]);
    const out: number[] = [];
    for (let i = a; ; i = (i + 1) % 7) {
      out.push(i);
      if (i === b) break;
    }
    return out;
  }
  return found;
}

export function weeklyHours(analysis: Analysis): Map<number, { open: number; close: number }> {
  const hours = new Map<number, { open: number; close: number }>();
  for (const entry of analysis.business.hours) {
    const open = parseClock(entry.open);
    const close = parseClock(entry.close);
    if (open === null || close === null || close <= open) continue;
    for (const day of dayIndexes(entry.days)) hours.set(day, { open, close });
  }
  if (hours.size === 0) for (const day of [1, 2, 3, 4, 5]) hours.set(day, { open: 8 * 60, close: 17 * 60 });
  return hours;
}

export function spokenTime(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "EEEE, MMMM d 'at' h:mm a zzz");
}

export function mockSlots(prospectId: string, analysis: Analysis, now = new Date()): MockSlot[] {
  const tz = analysis.business.timezone || "America/New_York";
  const hours = weeklyHours(analysis);
  const booked = bookingsFor(prospectId);
  const slots: MockSlot[] = [];
  for (let d = 0; d <= DAYS_AHEAD; d++) {
    const day = addDays(now, d);
    const ymd = formatInTimeZone(day, tz, "yyyy-MM-dd");
    const dow = Number(formatInTimeZone(day, tz, "i")) % 7;
    const window = hours.get(dow);
    if (!window) continue;
    for (let m = Math.max(window.open, APPT_OPEN); m + 60 <= Math.min(window.close, APPT_CLOSE); m += 60) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const start = fromZonedTime(`${ymd}T${hh}:${mm}:00`, tz);
      if (start.getTime() < now.getTime() + 2 * 3600_000) continue;
      const end = new Date(start.getTime() + 60 * 60_000);
      const booking = booked.find((b) => new Date(b.starts_at).getTime() === start.getTime());
      const busy = parseInt(sha256(`${prospectId}:${start.toISOString()}`).slice(0, 2), 16) < 90;
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: spokenTime(start, tz),
        status: booking ? "booked" : busy ? "busy" : "open",
        bookedFor: booking?.customer_name ?? undefined,
      });
    }
  }
  return slots;
}
