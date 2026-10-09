// Google Places API (New): autocomplete, place details, and text search.
// Field masks list only the fields the confirm card and the analysis prompt read.
// Nothing returned here is written to the database except the place id (see docs/places-terms.md).

import type { PlaceCard } from "./confirm";
import { resolvePlaceTarget, type ParsedPlace } from "./mapsLink";
import type { PlaceProfile } from "./sources";

// Port St. Lucie, FL. Autocomplete and text search bias here; results stay in the US.
export const PORT_ST_LUCIE = { latitude: 27.273049, longitude: -80.358226 };

export function placesBiasRadiusMeters(): number {
  const raw = Number(process.env.PLACES_BIAS_RADIUS_METERS ?? 40_000);
  if (!Number.isFinite(raw)) return 40_000;
  return Math.min(50_000, Math.max(1_000, Math.round(raw)));
}

export const PLACE_DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "websiteUri",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "businessStatus",
] as const;

export const PLACE_DETAIL_FIELD_MASK = PLACE_DETAIL_FIELDS.join(",");

export const TEXT_SEARCH_FIELD_MASK = PLACE_DETAIL_FIELDS.map((field) => `places.${field}`).join(",");

export const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
].join(",");

type RawPlace = {
  id?: string;
  name?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  businessStatus?: string;
};

export type Suggestion = { placeId: string; label: string; secondary: string };

export type MatchResult = {
  primary: PlaceCard;
  alternates: PlaceCard[];
  via: "autocomplete" | "place_id" | "cid" | "text";
  profile: PlaceProfile;
};

function mapsKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
}

function biasBody(): Record<string, unknown> {
  return {
    circle: {
      center: PORT_ST_LUCIE,
      radius: placesBiasRadiusMeters(),
    },
  };
}

function cardFromPlace(place: RawPlace): PlaceCard | null {
  const placeId = place.id?.trim() || place.name?.replace(/^places\//, "").trim();
  const name = place.displayName?.text?.trim();
  if (!placeId || !name) return null;
  return {
    placeId,
    name,
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    category: place.primaryTypeDisplayName?.text || "",
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    website: place.websiteUri || "",
  };
}

function profileFromPlace(place: RawPlace, query: string): PlaceProfile {
  const card = cardFromPlace(place);
  if (!card) return { found: false, query, error: "The place had no name" };
  return {
    found: true,
    query,
    placeId: card.placeId,
    name: card.name,
    address: card.address,
    phone: card.phone,
    website: card.website,
    rating: card.rating ?? undefined,
    reviewCount: card.reviewCount ?? undefined,
    category: card.category,
    hours: place.regularOpeningHours?.weekdayDescriptions,
    businessStatus: place.businessStatus,
  };
}

async function googleFetch(url: string, init: { method: "GET" | "POST"; fieldMask: string; body?: unknown; sessionToken?: string }): Promise<unknown> {
  const headers: Record<string, string> = {
    "X-Goog-Api-Key": mapsKey(),
    "X-Goog-FieldMask": init.fieldMask,
    "Content-Type": "application/json",
  };
  const target = new URL(url);
  if (init.sessionToken) target.searchParams.set("sessionToken", init.sessionToken);
  const response = await fetch(target, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) {
    console.error("places request failed", response.status, body?.error?.message || "");
    throw new Error("places_failed");
  }
  return body;
}

export async function autocompletePlaces(input: string, sessionToken: string): Promise<Suggestion[]> {
  if (!mapsKey()) return [];
  const body = (await googleFetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    fieldMask: AUTOCOMPLETE_FIELD_MASK,
    body: {
      input,
      sessionToken,
      includedRegionCodes: ["us"],
      locationBias: biasBody(),
    },
  })) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }>;
  };
  const out: Suggestion[] = [];
  for (const suggestion of body.suggestions ?? []) {
    const prediction = suggestion.placePrediction;
    const placeId = prediction?.placeId?.trim();
    const label = prediction?.structuredFormat?.mainText?.text || prediction?.text?.text || "";
    if (!placeId || !label) continue;
    out.push({ placeId, label, secondary: prediction?.structuredFormat?.secondaryText?.text || "" });
  }
  return out.slice(0, 5);
}

export async function fetchPlaceById(placeId: string, query: string, sessionToken?: string): Promise<PlaceProfile> {
  if (!mapsKey()) return { found: false, query, placeId, error: "GOOGLE_MAPS_API_KEY is not set" };
  try {
    const place = (await googleFetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      method: "GET",
      fieldMask: PLACE_DETAIL_FIELD_MASK,
      sessionToken,
    })) as RawPlace;
    return profileFromPlace(place, query);
  } catch (error) {
    return { found: false, query, placeId, error: error instanceof Error && error.message === "places_failed" ? "Places lookup failed" : "Places lookup failed" };
  }
}

async function searchText(query: string): Promise<RawPlace[]> {
  if (!mapsKey() || !query.trim()) return [];
  const body = (await googleFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    fieldMask: TEXT_SEARCH_FIELD_MASK,
    body: {
      textQuery: query,
      pageSize: 5,
      regionCode: "US",
      locationBias: biasBody(),
    },
  })) as { places?: RawPlace[] };
  return body.places ?? [];
}

export async function matchBusiness(input: { placeId?: string; gbp?: string; website?: string; sessionToken?: string }): Promise<MatchResult | { error: string }> {
  if (!mapsKey()) return { error: "Business search is not configured yet." };
  let target: ParsedPlace = {};
  if (input.gbp?.trim()) {
    try {
      target = await resolvePlaceTarget(input.gbp);
    } catch {
      return { error: "That link could not be opened." };
    }
  }
  const fromAutocomplete = Boolean(input.placeId?.trim());
  const placeId = input.placeId?.trim() || target.placeId;
  const websiteHost = input.website ? safeHost(input.website) : "";
  const typed = input.gbp?.trim() && !/^https?:\/\//i.test(input.gbp.trim()) ? input.gbp.trim() : "";
  const textQuery = target.text || typed || websiteHost;
  const via: MatchResult["via"] = fromAutocomplete ? "autocomplete" : target.placeId ? "place_id" : target.cid ? "cid" : "text";

  let primaryProfile: PlaceProfile | null = null;
  if (placeId) {
    primaryProfile = await fetchPlaceById(placeId, textQuery || placeId, fromAutocomplete ? input.sessionToken : undefined);
  }

  const searched = await searchText(textQuery || primaryProfile?.name || "").catch(() => [] as RawPlace[]);
  const cards = searched.map(cardFromPlace).filter((card): card is PlaceCard => Boolean(card));

  let primary = primaryProfile?.found ? cardFromProfile(primaryProfile) : null;
  if (!primary && cards[0]) {
    primary = cards[0];
    primaryProfile = profileFromPlace(searched[0], textQuery || cards[0].name);
  }
  if (!primary || !primaryProfile?.found) {
    if (target.cid && !textQuery) return { error: "That link has no business name. Search by name instead." };
    return { error: "No matching business turned up. Try the name and city, or a different Maps link." };
  }
  const alternates = cards.filter((card) => card.placeId !== primary.placeId).slice(0, 4);
  return { primary, alternates, via, profile: { ...primaryProfile, placeId: primary.placeId, query: textQuery || primary.placeId } };
}

function cardFromProfile(profile: PlaceProfile): PlaceCard | null {
  if (!profile.placeId || !profile.name) return null;
  return {
    placeId: profile.placeId,
    name: profile.name,
    address: profile.address || "",
    phone: profile.phone || "",
    category: profile.category || "",
    rating: profile.rating ?? null,
    reviewCount: profile.reviewCount ?? null,
    website: profile.website || "",
  };
}

function safeHost(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
