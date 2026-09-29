import { brand, foundingOffer } from "@/lib/brand";

// Answers must match what is built today (docs/CAPABILITIES.md, docs/INTEGRATION_CHECKLIST.md).
export const faqPage = {
  meta: { title: "Questions", description: `Straight answers about how ${brand.products.scribe} handles your calls.` },
  headline: "Questions owners ask",
  items: [
    {
      q: "What happens when the assistant can't answer a question?",
      a: [
        "It doesn't guess. It takes the caller's name, number, and question, tells them you'll follow up, and sends you the message.",
        "It quotes only the prices and policies you've approved.",
      ],
    },
    {
      q: "Can I turn it off?",
      a: [
        "Yes. Calls ring your phone first, and the assistant picks up only when you don't. You can switch it off, and your number keeps working as it does today.",
      ],
    },
    {
      q: "Do I keep my number?",
      a: [
        "Yes. The number stays in your business's name. If you leave, you get a port-out package to move it anywhere.",
      ],
    },
    {
      q: "Do you record calls?",
      a: [
        "Florida requires everyone on a call to agree to a recording. The assistant says in its first sentence that it is an AI assistant and that the call is recorded.",
        "Recordings and transcripts belong to your business.",
      ],
    },
    {
      q: "What happens in an emergency?",
      a: [
        "If a caller mentions gas, smoke, a carbon monoxide alarm, sparking, or flooding near electrical, the assistant tells them to get safe and call 911 or the gas utility. It does not book the call.",
      ],
    },
    {
      q: "What does it connect to today?",
      a: ["These connections work today:"],
      list: [
        "Google Calendar: checks your availability and books jobs into your calendar.",
        "Email: sends reports, follow-up links, and call summaries.",
      ],
      after: "Anything not on this list isn't connected yet. We'll say so before we promise a connection.",
    },
    {
      q: "What languages does it speak?",
      a: [
        "English and Spanish, including switching partway through a call. If a caller asks for another language, the assistant says it isn't supported and offers a follow-up.",
      ],
    },
    {
      q: "Is there a contract?",
      a: [`No long-term contract. Founding access is ${foundingOffer.term}.`],
    },
  ],
} as const;
