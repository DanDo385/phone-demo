import { brand, foundingOffer } from "@/lib/brand";

export const pricingPage = {
  meta: { title: "Pricing", description: `${brand.company.name} plans and founding-access terms.` },
  headline: "Pricing",
  lede: "Month-to-month. No per-call surprises hidden in the fine print.",
  founding: {
    heading: foundingOffer.headline,
    slots: `${foundingOffer.slotsRemaining} of ${foundingOffer.totalSlots} founding spots open`,
    terms: foundingOffer.terms,
  },
  fairUse:
    "Usage is metered per business. The included allowance is published after the first pilot month.",
  // Keep this list current: it must match docs/CAPABILITIES.md and the feature flags.
  notIncludedYet: {
    heading: "Not included yet",
    items: [
      "Taking over a live call from the assistant partway through",
      "Text-message intake (waiting on carrier registration)",
      "Languages other than English and Spanish",
      "Dispatching emergencies. The assistant sends callers to 911 or the gas utility instead.",
    ],
  },
  ownershipHeading: "What you own",
} as const;
