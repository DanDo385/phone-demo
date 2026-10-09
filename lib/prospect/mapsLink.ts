// Turn a Google Maps link, a short link, or a typed name into a place id, a CID, or text.
// Short links are followed only when the hostname is exactly one of the hosts below, and
// only through safeFetch. A query string that merely contains "goo.gl" is not followed.

import { safeFetch } from "../safeFetch";

export const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.page", "share.google"]);

export type ParsedPlace = {
  placeId?: string;
  cid?: string;
  text?: string;
};

export function shortLinkHost(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return SHORT_LINK_HOSTS.has(host) ? host : null;
}

function cleanPlaceId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return undefined;
  return id;
}

function nameFromPath(pathname: string, marker: string): string | undefined {
  const match = pathname.match(new RegExp(`/${marker}/([^/]+)`));
  if (!match) return undefined;
  try {
    const name = decodeURIComponent(match[1]).replace(/\+/g, " ").trim();
    if (!name || name.startsWith("ChI")) return undefined;
    return name;
  } catch {
    return undefined;
  }
}

export function parseMapsUrl(raw: string): ParsedPlace {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {};
  }
  const decoded = decodeURIComponent(url.toString());
  let placeId =
    cleanPlaceId(url.searchParams.get("query_place_id")) ||
    cleanPlaceId(decoded.match(/!1s(ChI[A-Za-z0-9_-]{8,})/)?.[1]);
  const q = url.searchParams.get("q") || url.searchParams.get("query");
  if (!placeId && q?.toLowerCase().startsWith("place_id:")) placeId = cleanPlaceId(q.slice("place_id:".length));

  let cid = url.searchParams.get("cid")?.match(/^\d{5,}$/)?.[0];
  const hexCid = decoded.match(/!1s0x[0-9a-f]+:0x([0-9a-f]+)/i)?.[1];
  if (!cid && hexCid) {
    try {
      cid = BigInt(`0x${hexCid}`).toString(10);
    } catch {
      cid = undefined;
    }
  }

  let text = nameFromPath(url.pathname, "maps/place") || nameFromPath(url.pathname, "maps/search");
  if (!text && q && !q.toLowerCase().startsWith("place_id:")) text = q.replace(/\+/g, " ").trim();
  return { placeId, cid, text: text || undefined };
}

// Resolve a profile link or a typed name. Network follows only an exact short-link host.
export async function resolvePlaceTarget(gbpInput: string): Promise<ParsedPlace> {
  const raw = gbpInput.trim();
  if (!raw) return {};
  if (!/^https?:\/\//i.test(raw)) return { text: raw };
  let url = raw;
  if (shortLinkHost(raw)) {
    const resolved = await safeFetch(raw, { readBody: false });
    url = resolved.url;
  }
  return parseMapsUrl(url);
}
