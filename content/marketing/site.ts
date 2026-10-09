import { brand, callsToAction, foundingOffer } from "@/lib/brand";

// Navigation, footer, and the calls to action shared across the public site.

export const nav = [
  { href: "/presence", label: "Website" },
  { href: "/scribe", label: brand.products.scribe },
  { href: "/squire", label: brand.products.squire },
  { href: "/examples", label: "Examples" },
  { href: "/pricing", label: "Pricing" },
] as const;

export const cta = {
  upgrade: { label: callsToAction.primary, href: "/#upgrade" },
  receptionist: { label: callsToAction.secondary, href: "/examples#receptionist" },
  proposal: { label: "Request a tailored proposal", href: "/#consult" },
  walkthrough: { label: "Book a consultation", href: "/book" },
  founding: { label: "Request founding access", href: "/founding" },
  preview: callsToAction.preview,
} as const;

export const footer = {
  tagline: "Better visibility, faster response, and more booked business.",
  founding: foundingOffer.headline,
  links: [
    { href: "/ownership", label: "Ownership" },
    { href: "/faq", label: "Questions" },
    { href: "/founding", label: "Founding access" },
    { href: "/legal/privacy", label: "Privacy" },
    { href: "/legal/terms", label: "Terms" },
  ],
  demoNote: "Demonstrations on this site use fictional businesses. They are not clients, and their projects, prices, and outcomes are illustrative.",
} as const;
