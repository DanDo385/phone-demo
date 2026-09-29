import { brand, formatPrice, plan } from "@/lib/brand";

const { scribe, squire } = brand.products;

export const scribePage = {
  meta: { title: scribe, description: `${scribe} answers, books, invoices, and follows up on your existing business number.` },
  headline: `${scribe}: every call answered, booked, and followed up`,
  lede: `${scribe} works on the number you already have. It picks up when you can't, books the job into your calendar, and keeps one record from the first call to the review request.`,
  price: formatPrice(plan("scribe")),
  includes: plan("scribe").includes,
  sections: [
    {
      heading: "How calls reach it",
      body: "Your number rings your phone first. If you don't answer, the assistant picks up. Your number stays in your business's name.",
    },
    {
      heading: "What callers hear",
      body: "The assistant says in its first sentence that it is an AI assistant and that the call is recorded. It speaks English and Spanish. It quotes only the prices and policies you've approved.",
    },
    {
      heading: "Emergencies",
      body: "If a caller mentions gas, smoke, a carbon monoxide alarm, sparking, or flooding near electrical, the assistant tells them to get safe and call 911 or the gas utility. It does not book those calls.",
    },
    {
      heading: "What you approve",
      body: "Invoices are drafts until you approve them. Review requests go out only after you mark the job complete.",
    },
  ],
} as const;

export const squirePage = {
  meta: { title: squire, description: `${squire} keeps your local presence current with posts, photos, and short videos you approve.` },
  headline: `${squire}: a steady local presence you approve`,
  lede: `${squire} turns the work you already do into posts, blog updates, emails, and short videos. Nothing goes out until you approve it.`,
  status: "In beta during the founding pilot.",
  price: formatPrice(plan("scribeSquire")),
  priceNote: `${squire} comes with ${scribe} in the ${plan("scribeSquire").name} plan.`,
  includes: plan("scribeSquire").includes,
  sections: [
    { heading: "Your media, your library", body: "Photos and videos from your jobs go into a library you own and can export." },
    { heading: "An approval calendar", body: "Drafts land on a calendar. You approve, edit, or skip each one." },
    { heading: "Published where you choose", body: "Approved posts go to the channels you connect. You can disconnect any channel at any time." },
  ],
} as const;
