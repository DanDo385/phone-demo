import { brand, formatPrice, plan } from "@/lib/brand";

const { scribe, squire, presence } = brand.products;

export const presencePage = {
  meta: {
    title: presence,
    description: `${presence} is a managed website and listing service. It is available alone or with ${scribe} or ${squire}.`,
  },
  headline: `${presence}`,
  lede: "A site that makes the work clear, captures the inquiry, and gives an existing customer a secure way in. Available on its own, or bundled with either product.",
  price: formatPrice(plan("presence")),
  includes: plan("presence").includes,
  sections: [
    {
      heading: "What we assess",
      body: "Mobile usability, calls to action, quote and booking paths, service clarity, contact details, hours, project photos, reviews, accessibility, basic search information, structured data, and whether the website and the public listing agree. Each note says whether we observed it, inferred it, or still need owner access.",
    },
    {
      heading: "What we do not invent",
      body: "Licenses, reviews, warranties, project photos, service areas, and performance claims come from you or from a page we fetched. Generated sample sections are marked as samples.",
    },
    {
      heading: "Hosting",
      body: "The domain stays in your registrar account. We can connect DNS, TLS, hosting, and backups after you authorize it, and we hand the site back with an export.",
    },
  ],
} as const;

export const scribePage = {
  meta: {
    title: scribe,
    description: `${scribe} answers calls and messages, qualifies inquiries, collects files, and books appointments.`,
  },
  headline: `${scribe} keeps the inquiry moving`,
  lede: `${scribe} is the receptionist and customer communication service. It answers, qualifies, collects photos and documents, books from your availability, and hands the work to your team. Private account details wait for a verified sign-in.`,
  price: formatPrice(plan("scribe")),
  includes: plan("scribe").includes,
  sections: [
    {
      heading: "One record, several channels",
      body: "Phone, website chat, text messages, and email share the business knowledge, the customer record, and the tools. WhatsApp, Messenger, Instagram, and TikTok messages are adapter slots. A blocked channel has a supported alternative.",
    },
    {
      heading: "What it will and will not say",
      body: "It answers from the business's approved facts. It gathers scope, location, urgency, timing, and, when it matters, budget and who decides. It recognizes a commercial RFP as a priority lead and shows why. Binding quotes stay inside an approved rate card.",
    },
    {
      heading: "Emergencies and handoff",
      body: "Gas, smoke, a carbon monoxide alarm, sparking, or flooding near electrical is not a booking. The caller is told to get safe and call 911 or the gas utility. Uncertain or sensitive requests go to a person. If a provider is down, the inquiry is kept and routed to the fallback.",
    },
    {
      heading: "Languages",
      body: "English and Spanish are the configured languages. A language is described as tested only after that path has been exercised. Switching language keeps the same inquiry and the same history.",
    },
  ],
} as const;

export const squirePage = {
  meta: {
    title: squire,
    description: `${squire} follows an inquiry through the job, payment, a review invitation, and approved content.`,
  },
  headline: `${squire} finishes the job in public`,
  lede: `${squire} is the workflow and marketing service. The estimate, the visit, the photos, the invoice, the payment, the review invitation, and the content drafts stay on one timeline.`,
  price: formatPrice(plan("squire")),
  priceNote: `${squire} can be bundled with ${scribe} and the website service. The public price is a proposal.`,
  includes: plan("squire").includes,
  sections: [
    {
      heading: "The record of the job",
      body: "Each stage shows what the customer sees, what the business keeps, which tool ran, and what happens next. Content can be drafted while the job is still open.",
    },
    {
      heading: "Reviews",
      body: "After the work is complete and payment is confirmed, the customer may receive the business's verified review link. The invitation asks for an honest review. There is no incentive and no filter by predicted sentiment. The customer writes and submits it. Reminders stop when they finish, opt out, or hit the limit.",
    },
    {
      heading: "Content",
      body: "Drafts use the job's notes, approved claims, and files the customer allowed. Originals are kept. Illustrations are labeled so they are not mistaken for photos of the work. Nothing goes out until you approve it.",
    },
  ],
} as const;
