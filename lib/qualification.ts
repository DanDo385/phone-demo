import { z } from "zod";

// prospects.qualification_json: five criteria, each 0 (no), 1 (partly), 2 (clearly).
// A score records what the owner told us or what we observed, never a guess.

export const QUALIFICATION_CRITERIA = [
  "urgent_high_value_jobs",
  "owner_answers_phone",
  "weak_web_profile",
  "calendar_discipline",
  "can_absorb_overflow",
] as const;

export type QualificationCriterion = (typeof QUALIFICATION_CRITERIA)[number];

const score = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export const Qualification = z.strictObject({
  urgent_high_value_jobs: score,
  owner_answers_phone: score,
  weak_web_profile: score,
  calendar_discipline: score,
  can_absorb_overflow: score,
});

export type Qualification = z.infer<typeof Qualification>;

export function qualificationTotal(q: Qualification): number {
  return QUALIFICATION_CRITERIA.reduce((sum, key) => sum + q[key], 0);
}

export const LEAD_STATUSES = ["new", "contacted", "walkthrough_booked", "qualified", "pilot", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const CONSENT_CHANNELS = ["email", "sms", "call_recording"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];
