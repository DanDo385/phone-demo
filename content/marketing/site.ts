import { brand, foundingOffer } from "@/lib/brand";

// Navigation, footer, and the calls to action shared across the public site.

export const nav = [
  { href: "/scribe", label: brand.products.scribe },
  { href: "/squire", label: brand.products.squire },
  { href: "/pricing", label: "Pricing" },
  { href: "/ownership", label: "Ownership" },
  { href: "/faq", label: "FAQ" },
] as const;

export const cta = {
  report: { label: "Get my free local-presence report", href: "/#report" },
  hearYourBusiness: { label: "Hear your own business answer the phone", href: "/try?intent=call" },
  // The fictional Palmetto Coast phone experience. It sits behind the demo owner login today.
  demoBusiness: { label: "Try the demo business", href: "/call" },
  walkthrough: { label: "Book a 15-minute walkthrough", href: "/book" },
  founding: { label: "Request founding access", href: "/founding" },
} as const;

export const footer = {
  tagline: "Fewer missed jobs, faster follow-up, cleaner operations, a better local presence.",
  founding: foundingOffer.headline,
  links: [
    { href: "/founding", label: "Founding access" },
    { href: "/research", label: "Research" },
    { href: "/legal/privacy", label: "Privacy" },
    { href: "/legal/terms", label: "Terms" },
    { href: "/demo", label: "Demo business" },
  ],
  demoNote: "Palmetto Coast Home Services is a fictional business we use for demos. Its customers, prices, and reviews are made up.",
} as const;
