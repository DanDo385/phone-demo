import { brand, ownershipPromise } from "@/lib/brand";

const { scribe, squire, presence } = brand.products;

export const home = {
  meta: {
    title: "Stand out online. Turn more inquiries into booked business.",
    description: `A stronger website, an always-available receptionist, and a workflow from the first question to payment, reviews, and the next marketing story.`,
  },
  hero: {
    eyebrow: "For service businesses with serious inquiries",
    headline: "Stand out online. Turn more inquiries into booked business.",
    subhead:
      "A stronger website, an always-available receptionist, and a connected workflow that takes customers from their first question to payment, reviews, and your next great marketing story.",
  },
  upgrade: {
    heading: "See your business upgraded",
    body: "Start with your website and your Google profile link. We read the public pages we are allowed to fetch and show what we found, what we would change, and a preview. Your name and email wait until you want the report saved, a conversation, or the site launched.",
  },
  scribe: {
    heading: `${scribe} answers, qualifies, and books`,
    body: `${scribe} is the business's receptionist and customer communication service. The same knowledge, permissions, and tools sit behind the phone, the website chat, text, and email.`,
    caption: "Fictional demonstration. Cedarline Roofing is not a real company.",
  },
  squire: {
    heading: `${squire} carries the job through to the story`,
    body: `${squire} is the workflow and marketing service. One inquiry moves through the estimate, the scheduled work, documentation, invoicing, payment, a review invitation, and content the owner approves.`,
    caption: "Illustrative timeline. Project values and outcomes are sample figures, not a client result.",
  },
  industries: {
    heading: "Built for substantial service work",
    body: "Homeowners and commercial decision-makers. We lead with roofing, solar installation, remodeling, commercial construction, industrial services, and property management. Plumbing and HVAC are part of the same system.",
  },
  evidence: {
    heading: "What a large call study shows, and what it does not",
    sourceName: "Invoca Lead Conversion Benchmarks Report, July 2026",
    sourceUrl: "https://www.invoca.com/reports/the-invoca-lead-conversion-benchmarks-report-2026",
    sourceNote:
      "Invoca says the report analyzes over 70 million calls and 600 million conversation minutes across ten industries. The figures below are averages across Invoca's customer base. They are not a promise about your business.",
    stats: [
      { value: "56%", label: "of callers to businesses speak with a person" },
      { value: "38%", label: "of calls from digital marketing are leads" },
      { value: "42%", label: "of those leads convert during the call" },
    ],
    limit:
      "The remaining 44% does not establish how many customers or how much revenue were lost. Use the calculator below as a scenario. Replace every assumption with your own numbers.",
  },
  comparison: {
    heading: "Choose the website, the receptionist, the workflow, or all three",
    body: `${presence} can stand alone. ${scribe} and ${squire} can be added. Pricing is a written proposal.`,
  },
  ownership: {
    heading: "You keep the domain",
    promise: ownershipPromise,
    points: [
      "The domain stays in a registrar account the client owns. We connect DNS only when you authorize it.",
      "Hosting includes TLS, backups, and an export. Publishing the new site requires your authorization.",
      "A Google profile link starts an assessment. Changing the live listing requires an owner-authorized connection.",
    ],
  },
  consult: {
    heading: "Talk through your business",
    body: "Tell us what you want more of. We reply with a proposal. We do not publish a price until the commercial terms are set.",
  },
} as const;
