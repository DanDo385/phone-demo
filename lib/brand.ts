// The single source for Docent Solutions' names, prices, offer terms, and look. Pages,
// emails, and prompts read these values; nothing else may hardcode them. Palmetto Coast is
// the fictional demo business and keeps its own copy in lib/business.ts.
//
// Pricing and the founding offer are a launch hypothesis. Change them here and nowhere else.

export const brand = {
  company: {
    name: "Docent Solutions",
    shortName: "Docent",
  },
  products: {
    scribe: "Scribe",
    squire: "Squire",
  },
  // Not yet confirmed as registered. Used for canonical URLs and deploy docs, never for
  // server-to-server calls (those use APP_BASE_URL).
  domain: "docentsolutions.com",
  // Also mirrored as CSS custom properties by brandCssVariables(). Checked for WCAG 2.2 AA
  // body text: ink, inkSoft, muted and accent on paper or card (>= 4.5:1), card on accent
  // (5.1:1). Accent text on accentSoft is 4.49:1, so use ink or inkSoft there.
  colors: {
    ink: "#101828",
    inkSoft: "#344054",
    muted: "#5d6679",
    line: "#e4e7ec",
    paper: "#f6f7f9",
    card: "#ffffff",
    accent: "#1f5eff",
    accentSoft: "#eaf0ff",
  },
  // Family names only. next/font needs literal calls, so lib/fonts.ts loads these same
  // families; change both together.
  fonts: {
    display: "Fraunces",
    text: "Outfit",
  },
} as const;

export type PlanKey = "scribe" | "scribeSquire" | "custom";

export type Plan = {
  key: PlanKey;
  name: string;
  // Whole US dollars per month; null means quoted.
  monthlyUsd: number | null;
  summary: string;
  includes: readonly string[];
};

export const plans: readonly Plan[] = [
  {
    key: "scribe",
    name: brand.products.scribe,
    monthlyUsd: 297,
    summary: "Answers, books, and follows up so fewer jobs slip away.",
    includes: [
      "Voice and SMS/MMS intake",
      "Booking and job records",
      "Draft invoices and payment links",
      "Review-request workflow",
      "Website and Google profile improvement workflow",
      "Owner portal and reports",
    ],
  },
  {
    key: "scribeSquire",
    name: `${brand.products.scribe} + ${brand.products.squire}`,
    monthlyUsd: 497,
    summary: `Everything in ${brand.products.scribe}, plus a steady local presence you approve.`,
    includes: [
      `Everything in ${brand.products.scribe}`,
      "Owned media library",
      "Post, blog, and email drafts",
      "Short-form video",
      "Approval calendar",
      "Channel publishing adapters",
    ],
  },
  {
    key: "custom",
    name: "Custom",
    monthlyUsd: null,
    summary: "For larger or unusual operations. Setup fee plus a higher retainer.",
    includes: ["Scoped after a walkthrough", "Setup fee and retainer quoted in writing"],
  },
];

export function plan(key: PlanKey): Plan {
  const found = plans.find((p) => p.key === key);
  if (!found) throw new Error(`Unknown plan ${key}`);
  return found;
}

export function formatPrice(p: Plan): string {
  return p.monthlyUsd === null ? "Quoted" : `$${p.monthlyUsd}/month`;
}

const FOUNDING_SLOTS = 5;
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export const foundingOffer = {
  // Shown as "Founding access now open". No countdowns, no urgency copy.
  headline: "Founding access now open",
  totalSlots: FOUNDING_SLOTS,
  // Update by hand as founding businesses sign. It must never overstate what is left.
  slotsRemaining: FOUNDING_SLOTS,
  plan: "scribe" as PlanKey,
  setupFeeWaived: true,
  squireBetaIncluded: true,
  term: "month-to-month",
  terms: [
    `Open to the first ${NUMBER_WORDS[FOUNDING_SLOTS] ?? FOUNDING_SLOTS} qualified businesses`,
    `${brand.products.scribe} at ${formatPrice(plan("scribe"))}`,
    "Standard setup fee waived",
    `${brand.products.squire} beta included during the pilot`,
    "Month-to-month; no long-term contract",
  ],
} as const;

export const ownershipPromise = `You own the number, domain, data, listing, calendar, and merchant account. ${brand.company.shortName} operates them with revocable access.`;

// CSS custom properties for a layout's root element, so stylesheets use var(--brand-*)
// instead of hex values.
export function brandCssVariables(): Record<string, string> {
  const c = brand.colors;
  return {
    "--brand-ink": c.ink,
    "--brand-ink-soft": c.inkSoft,
    "--brand-muted": c.muted,
    "--brand-line": c.line,
    "--brand-paper": c.paper,
    "--brand-card": c.card,
    "--brand-accent": c.accent,
    "--brand-accent-soft": c.accentSoft,
  };
}
