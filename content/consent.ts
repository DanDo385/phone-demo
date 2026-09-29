import { brand } from "@/lib/brand";

// Consent wording. The server stores the exact text and its version in `consents`
// (CLAUDE.md). The version is derived from the text, so any wording or brand change
// gets a new version automatically. Pages render these strings; they never paraphrase them.

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export type ConsentText = { channel: "email" | "sms" | "call_recording"; text: string; version: string };

function consent(channel: ConsentText["channel"], label: string, text: string): ConsentText {
  return { channel, text, version: `${label}-${fnv1a(text)}` };
}

export const foundingEmailConsent = consent(
  "email",
  "founding-email",
  `By sending this form you agree that ${brand.company.name} may email you about founding access. No newsletter unless you ask for one.`,
);

// Shown next to a separate, unchecked checkbox. Required wording for SMS program
// registration: program, frequency, rates, STOP/HELP, not a condition of purchase.
export const foundingSmsConsent = consent(
  "sms",
  "founding-sms",
  `Text me at this number about my founding-access request. ${brand.company.name} sends up to 4 messages per month. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.`,
);

// Shown under the analyzer (/try and the homepage) before the email field is submitted.
export const analyzerEmailConsent = consent(
  "email",
  "analyzer-email",
  `We email your report, and a summary of any demo call you make, to this address. ${brand.company.name} will not add you to a newsletter.`,
);
