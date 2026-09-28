import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const BUSINESS_TZ = "America/New_York";

const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function businessNow(offsetMs = 0): Date {
  return new Date(Date.now() + offsetMs);
}

export function zonedParts(date: Date) {
  const hour = Number(formatInTimeZone(date, BUSINESS_TZ, "H"));
  const minute = Number(formatInTimeZone(date, BUSINESS_TZ, "m"));
  const isoDow = Number(formatInTimeZone(date, BUSINESS_TZ, "i"));
  const y = Number(formatInTimeZone(date, BUSINESS_TZ, "yyyy"));
  const mo = Number(formatInTimeZone(date, BUSINESS_TZ, "M"));
  const d = Number(formatInTimeZone(date, BUSINESS_TZ, "d"));
  return { hour, minute, isoDow, y, mo, d, minutesOfDay: hour * 60 + minute };
}

/** Monday–Friday 8:00–18:00, Saturday 9:00–13:00. Sunday closed. */
export function isOpenAt(date: Date): boolean {
  const { isoDow, minutesOfDay } = zonedParts(date);
  if (isoDow >= 1 && isoDow <= 5) return minutesOfDay >= 8 * 60 && minutesOfDay < 18 * 60;
  if (isoDow === 6) return minutesOfDay >= 9 * 60 && minutesOfDay < 13 * 60;
  return false;
}

export function windowForDow(isoDow: number): { start: number; end: number } | null {
  if (isoDow >= 1 && isoDow <= 5) return { start: 8 * 60, end: 18 * 60 };
  if (isoDow === 6) return { start: 9 * 60, end: 13 * 60 };
  return null;
}

export function zonedDateTime(y: number, m: number, d: number, hour: number, minute: number): Date {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  return fromZonedTime(`${y}-${mm}-${dd}T${hh}:${mi}:00`, BUSINESS_TZ);
}

export function addBusinessDays(from: Date, days: number): Date {
  return addDays(from, days);
}

export function formatSpoken(date: Date, lang: "en" | "es"): string {
  const { hour, minute, isoDow, mo, d, y } = zonedParts(date);
  const weekdayIndex = isoDow === 7 ? 0 : isoDow;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "a.m." : "p.m.";
  const min = minute === 0 ? "00" : String(minute).padStart(2, "0");
  if (lang === "es") {
    return `el ${WEEKDAY_ES[weekdayIndex]} ${d} de ${MONTH_ES[mo - 1]} de ${y} a las ${h12}:${min} ${ampm}, hora del Este`;
  }
  return `${WEEKDAY_EN[weekdayIndex]}, ${MONTH_EN[mo - 1]} ${d}, ${y} at ${h12}:${min} ${ampm} Eastern Time`;
}

export function formatDashboard(date: Date): string {
  return formatInTimeZone(date, BUSINESS_TZ, "EEE MMM d, yyyy · h:mm a");
}

export function demoClockLabel(offsetMs: number): string {
  const hours = Math.round(offsetMs / 3_600_000);
  if (!offsetMs) return "Demo clock +0 h. Wall time is unchanged.";
  const waited = hours >= 48 ? "A real 48-hour wait did not elapse." : "A real wait did not elapse.";
  return `Demo clock +${hours} h. ${waited} This offset is global for the demo.`;
}

export function nextSendingInstant(after: Date): Date {
  const probe = new Date(after.getTime());
  for (let i = 0; i < 14 * 24 * 2; i++) {
    if (isOpenAt(probe)) return probe;
    probe.setTime(probe.getTime() + 30 * 60 * 1000);
  }
  return after;
}

export function plusMinutes(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

export { formatInTimeZone };
