import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AnalysisSchema, type Analysis } from "./schema";
import type { PlaceProfile, SiteScrape } from "./sources";

const MODEL = process.env.PROSPECT_ANALYSIS_MODEL || "claude-opus-5";

const SYSTEM = `You prepare a sales demo of an AI phone receptionist for a small service business.
You receive what was found on the business's website and its Google Business Profile.

Produce three things:
1. A working business profile the receptionist can use on a live call. Use real facts first.
   Where something needed for a believable call is missing (prices, hours, policies, FAQs,
   service durations), invent plausible values typical for this trade and region and mark
   them filler: true. Never mark a real, found fact as filler.
2. A gap report from the owner's point of view: what a caller or searcher cannot find, and
   where the website and the profile disagree (phone, hours, address, services, name).
   Cite what you saw. Order by severity. Do not pad; skip gaps you have no evidence for.
3. Suggested enhancements the owner could make to the site and profile, concrete enough
   to act on this week.

The receptionist greeting must name the business and say it is an AI assistant.
Write for the owner: plain words, no marketing filler.`;

function sourcesText(site: SiteScrape, place: PlaceProfile, website: string): string {
  const pages = site.ok
    ? site.pages.map((p) => `### ${p.title || p.url}\nURL: ${p.url}\n\n${p.markdown}`).join("\n\n")
    : `The website (${website}) could not be read: ${site.error ?? "unknown error"}.`;
  const gbp = place.found
    ? JSON.stringify(
        {
          name: place.name,
          category: place.category,
          address: place.address,
          phone: place.phone,
          website: place.website,
          hours: place.hours,
          rating: place.rating,
          review_count: place.reviewCount,
          business_status: place.businessStatus,
          summary: place.summary,
          photo_count: place.photoCount,
          recent_reviews: place.reviews,
        },
        null,
        2,
      )
    : `No Google Business Profile was found for "${place.query}"${place.error ? ` (${place.error})` : ""}.`;
  return `<website url="${website}">\n${pages}\n</website>\n\n<google_business_profile>\n${gbp}\n</google_business_profile>`;
}

export async function analyzeProspect(input: { website: string; site: SiteScrape; place: PlaceProfile }): Promise<Analysis> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(AnalysisSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: sourcesText(input.site, input.place, input.website) }],
  });
  if (response.stop_reason === "refusal") throw new Error("The analysis was declined");
  if (!response.parsed_output) throw new Error(`The analysis did not return a profile (stop: ${response.stop_reason})`);
  return response.parsed_output;
}
