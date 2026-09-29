import { z } from "zod";

// Everything the prospect demo needs, produced by one Claude call from the website
// scrape and the Google Business Profile. `filler: true` marks invented details so the
// report can show them as "we filled this in" and the call still works.

const Fact = z.object({ value: z.string(), filler: z.boolean() });

export const AnalysisSchema = z.object({
  business: z.object({
    name: z.string(),
    industry: z.string().describe("Plain-language trade, e.g. 'residential plumbing'"),
    tagline: z.string(),
    phone_display: Fact,
    address: Fact,
    service_area: z.array(z.string()),
    hours: z.array(z.object({ days: z.string(), open: z.string(), close: z.string() })),
    hours_filler: z.boolean(),
    timezone: z.string().describe("IANA zone, e.g. America/New_York"),
    languages: z.array(z.string()),
    owner_or_manager: Fact,
    years_in_business: Fact,
  }),
  services: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        price: z.string().describe("Spoken price or range, e.g. '$89 diagnostic, credited to the repair'"),
        duration_minutes: z.number().int(),
        filler: z.boolean(),
      }),
    )
    .describe("4 to 8 services"),
  faqs: z.array(z.object({ question: z.string(), answer: z.string(), filler: z.boolean() })).describe("5 to 8"),
  policies: z.array(Fact).describe("Booking, cancellation, payment, warranty, emergency"),
  gaps: z
    .array(
      z.object({
        source: z.enum(["website", "google_business_profile", "both", "mismatch"]),
        severity: z.enum(["high", "medium", "low"]),
        title: z.string(),
        detail: z.string().describe("What is missing or inconsistent, citing what was found"),
        why_it_matters: z.string().describe("Effect on calls, bookings, or search visibility"),
      }),
    )
    .describe("Missing or inconsistent information, most severe first"),
  enhancements: z
    .array(z.object({ title: z.string(), detail: z.string(), impact: z.enum(["high", "medium", "low"]) }))
    .describe("5 to 8 concrete improvements for the site and profile"),
  call_flow: z.object({
    ring_seconds_before_ai: z.number().int(),
    after_hours: z.string().describe("What the AI does after hours for this business"),
    handoffs: z.array(z.string()).describe("When the AI should hand off to a person"),
  }),
  voice: z.object({
    first_message: z.string().describe("Greeting that names the business and says it is an AI assistant"),
    persona: z.string().describe("Two sentences on tone and style"),
    booking_rules: z.string(),
    scope_rules: z.string().describe("Topics the receptionist declines, politely"),
  }),
  try_saying: z.array(z.string()).describe("4 to 6 things the prospect could say on the demo call"),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
