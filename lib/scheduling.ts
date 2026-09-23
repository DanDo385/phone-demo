import { BUSINESS, technicianForTrade, serviceByCode, technicianById } from "./business";
import { formatSpoken, plusMinutes, windowForDow, zonedDateTime, zonedParts } from "./time";
import type { Slot } from "./types";

export type Busy = { technicianId: string; start: string; end: string };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number, bufferMs: number): boolean {
  return aStart < bEnd + bufferMs && aEnd + bufferMs > bStart;
}

export function slotFits(start: Date, durationMinutes: number): boolean {
  const end = plusMinutes(start, durationMinutes);
  const startParts = zonedParts(start);
  const endParts = zonedParts(end);
  const window = windowForDow(startParts.isoDow);
  if (!window) return false;
  if (startParts.minutesOfDay < window.start) return false;
  if (endParts.isoDow !== startParts.isoDow) return false;
  if (endParts.minutesOfDay > window.end) return false;
  return true;
}

export function listSlots(input: {
  now: Date;
  serviceCode: string;
  busy: Busy[];
  days?: number;
  limit?: number;
}): Slot[] {
  const service = serviceByCode(input.serviceCode) ?? serviceByCode("DIAG")!;
  const tech = technicianForTrade(service.trade);
  const bufferMs = BUSINESS.bufferMinutes * 60 * 1000;
  const slots: Slot[] = [];
  const startDay = zonedParts(input.now);
  for (let day = 0; day < (input.days ?? 8) && slots.length < (input.limit ?? 6); day++) {
    const base = new Date(Date.UTC(startDay.y, startDay.mo - 1, startDay.d));
    base.setUTCDate(base.getUTCDate() + day);
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth() + 1;
    const d = base.getUTCDate();
    const probe = zonedDateTime(y, m, d, 12, 0);
    const parts = zonedParts(probe);
    const window = windowForDow(parts.isoDow);
    if (!window) continue;
    for (let minute = window.start; minute < window.end; minute += 30) {
      const start = zonedDateTime(parts.y, parts.mo, parts.d, Math.floor(minute / 60), minute % 60);
      if (start.getTime() < input.now.getTime() + 60 * 60 * 1000) continue;
      if (!slotFits(start, service.durationMinutes)) continue;
      const end = plusMinutes(start, service.durationMinutes);
      const clash = input.busy.some(
        (b) =>
          b.technicianId === tech.id &&
          overlaps(start.getTime(), end.getTime(), new Date(b.start).getTime(), new Date(b.end).getTime(), bufferMs),
      );
      if (clash) continue;
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        technicianId: tech.id,
        technicianName: tech.name,
        labelEn: formatSpoken(start, "en"),
        labelEs: formatSpoken(start, "es"),
      });
      if (slots.length >= (input.limit ?? 6)) break;
    }
  }
  return slots;
}

export function findConflict(input: {
  technicianId: string;
  start: Date;
  end: Date;
  busy: Busy[];
}): Busy | undefined {
  const bufferMs = BUSINESS.bufferMinutes * 60 * 1000;
  return input.busy.find(
    (b) =>
      b.technicianId === input.technicianId &&
      overlaps(input.start.getTime(), input.end.getTime(), new Date(b.start).getTime(), new Date(b.end).getTime(), bufferMs),
  );
}

export function describeTechnicianLanguage(technicianId: string, lang: "en" | "es"): string {
  const tech = technicianById(technicianId);
  if (!tech) return "";
  const speaksEs = tech.languages.includes("es");
  if (lang === "es") {
    return speaksEs
      ? `${tech.name} puede atender la visita en español.`
      : `${tech.name} hace la visita en inglés. El seguimiento de la oficina puede continuar en español.`;
  }
  return speaksEs
    ? `${tech.name} can conduct the visit in Spanish.`
    : `${tech.name} conducts the visit in English. Office follow-up can continue in Spanish.`;
}
