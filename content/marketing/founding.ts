import { brand, foundingOffer } from "@/lib/brand";

export const foundingPage = {
  meta: { title: "Founding access", description: `${foundingOffer.headline}. ${foundingOffer.terms[0]}.` },
  headline: foundingOffer.headline,
  lede: `We're working closely with a small group of HVAC and plumbing shops while ${brand.company.shortName} launches.`,
  slots: `${foundingOffer.slotsRemaining} of ${foundingOffer.totalSlots} founding spots open`,
  terms: foundingOffer.terms,
  form: {
    heading: "Request founding access",
    businessName: "Business name",
    ownerName: "Your name",
    email: "Email",
    mobile: "Mobile number (optional)",
    trade: "Trade",
    today: "What happens today when you can't answer a call?",
    submit: "Send request",
    sending: "Sending…",
    done: "Thanks. We read every request and will reply by email.",
  },
  never: "We will never ask for passwords, payment details, or account logins on this site.",
} as const;
