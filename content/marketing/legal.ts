import { brand } from "@/lib/brand";

// Placeholders until counsel reviews them. The privacy page already carries the statements
// an SMS program registration needs to point at.
export const draftStamp = "DRAFT: pending legal review";

type Section = { heading: string; body: string[] };

export const privacyPage = {
  meta: { title: "Privacy", description: `${brand.company.name} privacy policy (draft).` },
  headline: "Privacy policy",
  sections: [
    {
      heading: "What we collect",
      body: [
        "Forms: your business name, your name, email, mobile number if you give one, trade, and what you tell us.",
        "The free report: the website and Google profile you enter, and the email and number you give us.",
        "Demo calls: recordings and transcripts of calls you make to your demo receptionist.",
        "Site usage: pages viewed and buttons pressed, tied to a random identifier rather than your name.",
      ],
    },
    {
      heading: "How we use it",
      body: [
        "To build your report and demo, reply to your requests, and run the services you sign up for.",
        "We do not sell personal information.",
      ],
    },
    {
      heading: "Text messages (SMS)",
      body: [
        "We text you only if you check the separate text-message box on a form. That box is never checked for you.",
        "Mobile numbers and text-message opt-in consent are not shared with third parties or affiliates for marketing or promotional purposes.",
        "Message frequency varies, up to 4 messages per month.",
        "Message and data rates may apply.",
        "Reply STOP to any message to opt out. Reply HELP for help.",
        "Consent to receive texts is not a condition of purchase.",
      ],
    },
    {
      heading: "Consent records",
      body: ["When you agree to email, texts, or call recording, we store the exact wording you saw, its version, and when you agreed."],
    },
    {
      heading: "Your choices",
      body: ["You can ask us to show, correct, or delete the information we hold about you. Contact details will be added before this policy is final."],
    },
  ] satisfies Section[],
} as const;

export const termsPage = {
  meta: { title: "Terms", description: `${brand.company.name} terms of service (draft).` },
  headline: "Terms of service",
  sections: [
    { heading: "Demos and reports", body: ["Demos and reports are built from public information. Anything we filled in is marked as filled in. They are not advice."] },
    { heading: "Services", body: ["Plans, prices, and founding-access terms are listed on the pricing page. Service terms will be set out here before any paid service starts."] },
    { heading: "Ownership", body: ["Your number, domain, data, listing, calendar, and merchant account stay yours. See the ownership page."] },
  ] satisfies Section[],
} as const;
