// Website (Firecrawl) and Google Business Profile (Places API New) lookups for the prospect demo.

export type SitePage = { url: string; title: string; markdown: string };
export type SiteScrape = { ok: boolean; pages: SitePage[]; error?: string };

export type PlaceProfile = {
  found: boolean;
  query: string;
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

const PLACE_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.regularOpeningHours",
  "places.businessStatus",
  "places.editorialSummary",
  "places.photos",
  "places.reviews",
].join(",");

// A GBP link rarely carries a usable place id, so resolve it to a text query:
// a /maps/place/<name> path segment, else the raw text, else the website's hostname.
export async function placeQuery(gbpInput: string, website: string): Promise<string> {
  const raw = gbpInput.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    let url = raw;
    if (/goo\.gl|g\.page|share\.google/i.test(raw)) {
      const resolved = await fetch(raw, { redirect: "follow", signal: AbortSignal.timeout(10000) }).catch(() => null);
      if (resolved) url = resolved.url;
    }
    const match = decodeURIComponent(url).match(/\/maps\/place\/([^/@]+)/);
    if (match) return match[1].replace(/\+/g, " ");
    const q = new URL(url).searchParams.get("q");
    if (q) return q;
  } else if (raw) {
    return raw;
  }
  return website ? new URL(website).hostname.replace(/^www\./, "") : "";
}

export async function lookupPlace(gbpInput: string, website: string): Promise<PlaceProfile> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const query = await placeQuery(gbpInput, website).catch(() => gbpInput);
  if (!key) return { found: false, query, error: "GOOGLE_MAPS_API_KEY is not set" };
  if (!query) return { found: false, query, error: "No business name or profile link" };
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": PLACE_FIELDS, "Content-Type": "application/json" },
      body: JSON.stringify({ textQuery: query, pageSize: 3 }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json()) as { places?: Array<Record<string, any>>; error?: { message?: string } };
    if (!response.ok) return { found: false, query, error: body.error?.message || `Places returned ${response.status}` };
    const host = website ? new URL(website).hostname.replace(/^www\./, "") : "";
    const places = body.places ?? [];
    // Prefer the result whose website matches the one the prospect entered.
    const place = places.find((p) => host && String(p.websiteUri || "").includes(host)) ?? places[0];
    if (!place) return { found: false, query };
    return {
      found: true,
      query,
      name: place.displayName?.text,
      address: place.formattedAddress,
      phone: place.nationalPhoneNumber,
      website: place.websiteUri,
      mapsUrl: place.googleMapsUri,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      category: place.primaryTypeDisplayName?.text,
      types: place.types,
      hours: place.regularOpeningHours?.weekdayDescriptions,
      businessStatus: place.businessStatus,
      summary: place.editorialSummary?.text,
      photoCount: Array.isArray(place.photos) ? place.photos.length : 0,
      reviews: (place.reviews ?? []).slice(0, 5).map((r: Record<string, any>) => ({
        rating: r.rating,
        text: String(r.text?.text ?? "").slice(0, 400),
        when: r.relativePublishTimeDescription ?? "",
      })),
    };
  } catch (error) {
    return { found: false, query, error: error instanceof Error ? error.message : "Places lookup failed" };
  }
}
