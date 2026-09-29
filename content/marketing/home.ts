import { brand, foundingOffer, ownershipPromise } from "@/lib/brand";

const { scribe } = brand.products;

// Homepage copy, in page order: Problem, Instant value, Proof, Offer, Action.
export const home = {
  meta: {
    title: "Answer every call, book the job",
    description: `${scribe} answers, books, invoices, and follows up on your existing business number, and ${brand.company.shortName} improves the website and Google presence that send those calls.`,
  },
  hero: {
    eyebrow: "For HVAC and plumbing shops on the Treasure Coast",
    headline: "Your next customer should not go to voicemail.",
    subhead: `${scribe} answers, books, invoices, and follows up on your existing business number. ${brand.company.shortName} also improves the website and Google presence that send those calls.`,
    reportNote: "Free. Built from your public website and Google profile. No login, no passwords.",
  },
  problem: {
    heading: "The phone rings while you're on a job",
    points: [
      { title: "You can't pick up", body: "You're under a sink, in an attic, or driving between calls. The call goes to voicemail." },
      { title: "They call the next shop", body: "Someone with a leak or no cooling doesn't wait for a callback. They try the next number on the list." },
      { title: "Your listing decides who they call", body: "Out-of-date hours, missing services, or an old website make it easy for a searcher to pick someone else." },
    ],
  },
  value: {
    heading: "See what a caller sees, in about a minute",
    body: "Enter your website. We read your public pages and Google profile and send back a short report:",
    points: [
      "What your website and profile say, and leave out, about your services, hours, and area.",
      "The gaps a caller or searcher would hit, each tied to what we found on your pages.",
      "A receptionist built from that information, which you can call yourself.",
      "Anything we had to fill in so the demo works is marked as filled in.",
    ],
  },
  proof: {
    heading: "What happens after the call",
    body: "One job, start to finish. The same record carries the call, the booking, the invoice, and the review request.",
    caption: "Sample job from Palmetto Coast Home Services, a fictional business we use for demos.",
  },
  offer: {
    heading: "Plain monthly pricing",
    ownershipHeading: "You own what we run",
    ownershipPromise,
    founding: `${foundingOffer.headline}. ${foundingOffer.terms.join(" · ")}.`,
  },
  action: {
    heading: "Start with the free report",
    body: "See what callers and searchers find today. If it's useful, book a 15-minute walkthrough and we'll go through it with you.",
  },
} as const;
