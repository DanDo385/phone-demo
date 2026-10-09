import { brand, foundingOffer } from "@/lib/brand";

export const pricingPage = {
  meta: { title: "Pricing", description: `Services from ${brand.company.name}. Commercial terms are in a written proposal.` },
  headline: "Pricing",
  lede: "Request a tailored proposal. No public price is listed until the commercial terms are set.",
  founding: {
    heading: foundingOffer.headline,
    slots: `${foundingOffer.slotsRemaining} of ${foundingOffer.totalSlots} founding conversations open`,
    terms: foundingOffer.terms,
  },
  fairUse: "Usage is metered per business and written into the proposal. This page does not imply an unlimited plan.",
  notIncludedYet: {
    heading: "Not connected for live use yet",
    items: [
      "WhatsApp, Messenger, Instagram, and TikTok messages, until each platform approves the app",
      "TikTok content publishing, which is a separate approval from TikTok messaging",
      "Automatic listing edits. A public profile link starts an assessment. Changes wait for an owner connection.",
      "Languages beyond the configured English and Spanish paths",
    ],
  },
  ownershipHeading: "What you own",
} as const;
