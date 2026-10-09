// The single source for names, prices, offer terms, and look. Pages, emails, and prompts
// read these values; nothing else may hardcode them.
//
// Product labels can change here without a copy rewrite. monthlyUsd stays null until
// commercial terms are provided. formatPrice then shows proposalLabel.

export const brand = {
  company: {
    name: "Docent Solutions",
    shortName: "Docent",
  },
  products: {
    scribe: "Scribe",
    squire: "Squire",
    presence: "Website and digital presence",
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

export const proposalLabel = "Request a tailored proposal";

export const callsToAction = {
  primary: "See your business upgraded.",
  secondary: "Try the receptionist.",
  preview:
    "Want this website live? We handle the build, hosting, and ongoing improvements. You keep ownership of your domain.",
} as const;

export type PlanKey = "presence" | "scribe" | "squire" | "combined";

export type Plan = {
  key: PlanKey;
  name: string;
  // Whole US dollars per month; null means the public site asks for a proposal.
  monthlyUsd: number | null;
  summary: string;
  includes: readonly string[];
};

export const plans: readonly Plan[] = [
  {
    key: "presence",
    name: brand.products.presence,
    monthlyUsd: null,
    summary: "A managed website and digital presence, on its own or bundled with either product.",
    includes: [
      "Website build, hosting, backups, and ongoing improvements",
      "The domain stays in the client's registrar account",
      "Service pages, lead capture, and a customer sign-in",
      "Profile improvements published only after the owner authorizes them",
      "A documented handoff and export",
    ],
  },
  {
    key: "scribe",
    name: brand.products.scribe,
    monthlyUsd: null,
    summary: "Answers calls and messages, qualifies the inquiry, collects files, books the appointment, and hands the work to the business.",
    includes: [
      "Phone, website chat, text, and email on one record",
      "Photos, plans, and other supported files",
      "Residential and commercial qualification, including RFPs",
      "Booking from connected availability",
      "Account details only after a verified sign-in",
      "A person takes over when the request is uncertain or sensitive",
    ],
  },
  {
    key: "squire",
    name: brand.products.squire,
    monthlyUsd: null,
    summary: "Carries the inquiry through the estimate, the job, the invoice, a review invitation, and content the owner approves.",
    includes: [
      "Estimate, schedule, job notes, and progress files",
      "Invoice and payment status from the system of record",
      "A neutral review invitation after completion and confirmed payment",
      "Drafts made from the job's own notes and approved files",
      "Nothing is published until the owner approves it",
    ],
  },
  {
    key: "combined",
    name: "Combined service",
    monthlyUsd: null,
    summary: "The website, the receptionist, and the workflow together, from the first question through payment and the next story.",
    includes: [
      `Everything in ${brand.products.presence}`,
      `Everything in ${brand.products.scribe}`,
      `Everything in ${brand.products.squire}`,
    ],
  },
];

export function plan(key: PlanKey): Plan {
  const found = plans.find((p) => p.key === key);
  if (!found) throw new Error(`Unknown plan ${key}`);
  return found;
}

export function formatPrice(p: Plan): string {
  return p.monthlyUsd === null ? proposalLabel : `$${p.monthlyUsd}/month`;
}

const FOUNDING_SLOTS = 5;
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export const foundingOffer = {
  headline: "Founding access now open",
  totalSlots: FOUNDING_SLOTS,
  slotsRemaining: FOUNDING_SLOTS,
  plan: "combined" as PlanKey,
  term: "month-to-month",
  terms: [
    `Open to the first ${NUMBER_WORDS[FOUNDING_SLOTS] ?? FOUNDING_SLOTS} qualified businesses`,
    "Commercial terms are written in a proposal. No public price is listed until those terms are set.",
    "Month-to-month once a proposal is accepted",
  ],
} as const;

export const ownershipPromise = `You own the number, domain, data, listing, calendar, and merchant account. The domain stays in your registrar account. ${brand.company.shortName} operates them with revocable access.`;

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
