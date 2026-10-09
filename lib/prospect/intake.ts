// Shared checks for the analyzer form. The confirm step is the only way to start analysis.

import { analyzerEmailConsent } from "@/content/consent";
import { TRADES } from "@/content/marketing/trades";
import { toE164 } from "../phone";
import { normalizeUrl } from "./sources";

const TRADE_VALUES = new Set<string>(TRADES.map((trade) => trade.value));

export type IntakeFields = {
  website: string;
  gbp: string;
  email: string;
  phone: string;
  trade: string;
  serviceArea: string;
  placeId: string;
  idempotencyKey: string;
};

export function parseIntake(body: Record<string, unknown>, options: { requireEmail: boolean }): IntakeFields | { error: string } {
  const website = normalizeUrl(String(body.website || ""));
  const email = String(body.email || "").trim().toLowerCase();
  const phone = toE164(String(body.phone || ""));
  const gbp = String(body.gbp || "").trim().slice(0, 500);
  const trade = String(body.trade || "").trim();
  const serviceArea = String(body.serviceArea || "").trim().slice(0, 160);
  const placeId = String(body.placeId || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (body.website && !website) return { error: "Enter your website address, including the domain." };
  if (options.requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (body.phone && !/^\+\d{10,15}$/.test(phone)) return { error: "Enter the mobile number you will call from." };
  if (trade && !TRADE_VALUES.has(trade)) return { error: "Choose HVAC, plumbing, or other." };
  if (!/^[A-Za-z0-9_-]{10,}$/.test(placeId)) return { error: "Confirm your business before we build the report." };
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) return { error: "Refresh the page and try again." };
  if (options.requireEmail && body.emailConsentVersion !== analyzerEmailConsent.version) {
    return { error: "This page is out of date. Refresh and try again." };
  }
  return { website, gbp, email, phone, trade, serviceArea, placeId, idempotencyKey };
}
