// Website (Firecrawl) and Google Business Profile (Places API New) lookups for the prospect demo.

export type SitePage = { url: string; title: string; markdown: string };
export type SiteScrape = { ok: boolean; pages: SitePage[]; error?: string };

export type PlaceProfile = {
  found: boolean;
  query: string;
  placeId?: string;
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  types?: string[];
  hours?: string[];
  businessStatus?: string;
  summary?: string;
  photoCount?: number;
  reviews?: Array<{ rating: number; text: string; when: string }>;
  error?: string;
};

// Pages beyond the homepage most likely to hold services, prices, hours and policies.
const USEFUL = /(service|pricing|price|rates|about|contact|faq|areas?|location|book|schedule|emergency)/i;
const MAX_EXTRA_PAGES = 3;
// Per-page character cap keeps one huge page from crowding out the rest of the site.
const PAGE_CHARS = 12000;

export function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return "";
    return u.toString();
  } catch {
    return "";
  }
}

async function firecrawlScrape(url: string): Promise<{ markdown: string; title: string; links: string[] } | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: false, timeout: 30000 }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    success?: boolean;
    data?: { markdown?: string; links?: string[]; metadata?: { title?: string } };
  };
  if (!body.success || !body.data) return null;
  return { markdown: body.data.markdown ?? "", title: body.data.metadata?.title ?? "", links: body.data.links ?? [] };
}

export async function scrapeWebsite(website: string): Promise<SiteScrape> {
  if (!process.env.FIRECRAWL_API_KEY) return { ok: false, pages: [], error: "FIRECRAWL_API_KEY is not set" };
  try {
    const home = await firecrawlScrape(website);
    if (!home) return { ok: false, pages: [], error: "The website could not be read" };
    const origin = new URL(website).origin;
    const extra = Array.from(
      new Set(
        home.links
          .filter((link) => link.startsWith(origin) && USEFUL.test(new URL(link).pathname))
          .map((link) => link.split("#")[0].replace(/\/$/, "")),
      ),
    )
      .filter((link) => link !== website.replace(/\/$/, ""))
      .slice(0, MAX_EXTRA_PAGES);
    const more = await Promise.all(extra.map((link) => firecrawlScrape(link).then((page) => (page ? { link, page } : null))));
    const pages: SitePage[] = [{ url: website, title: home.title, markdown: home.markdown.slice(0, PAGE_CHARS) }];
    for (const item of more) {
      if (item) pages.push({ url: item.link, title: item.page.title, markdown: item.page.markdown.slice(0, PAGE_CHARS) });
    }
    return { ok: true, pages };
  } catch (error) {
    return { ok: false, pages: [], error: error instanceof Error ? error.message : "Website scrape failed" };
  }
}

// A profile link becomes a place id, a CID, or a text query. Short links are followed only
// for an exact short-link hostname, through safeFetch. Place content is not stored here.
export async function placeQuery(gbpInput: string, website: string): Promise<string> {
  const { resolvePlaceTarget } = await import("./mapsLink");
  const target = await resolvePlaceTarget(gbpInput);
  if (target.text) return target.text;
  if (target.placeId) return target.placeId;
  if (target.cid) return target.cid;
  if (!gbpInput.trim()) return website ? new URL(website).hostname.replace(/^www\./, "") : "";
  return "";
}

export async function lookupPlace(gbpInput: string, website: string, placeId?: string): Promise<PlaceProfile> {
  const { fetchPlaceById, matchBusiness } = await import("./places");
  if (placeId) return fetchPlaceById(placeId, gbpInput || placeId);
  const match = await matchBusiness({ gbp: gbpInput, website });
  if ("error" in match) return { found: false, query: gbpInput || website, placeId, error: match.error };
  return match.profile;
}
