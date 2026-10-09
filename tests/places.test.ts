import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, get, resetDbForTests, run } from "../lib/db";
import { brand } from "../lib/brand";
import {
  analysisAllowed,
  backToConfirm,
  confirmSelected,
  pickAlternate,
  showAlternates,
  showMatch,
  startSearch,
  type PlaceCard,
} from "../lib/prospect/confirm";
import { parseMapsUrl, resolvePlaceTarget, shortLinkHost } from "../lib/prospect/mapsLink";
import { PLACE_DETAIL_FIELD_MASK, TEXT_SEARCH_FIELD_MASK } from "../lib/prospect/places";
import { runAnalysis } from "../lib/prospect/pipeline";
import { confirmProspectPlace, reopenProspectConfirm, saveSources } from "../lib/prospect/store";
import { SAFE_FETCH_MAX_BYTES, SAFE_FETCH_USER_AGENT, isBlockedAddress, safeFetch, setSafeFetchDepsForTests, type SafeFetchDeps } from "../lib/safeFetch";

const PLACE_ID = "ChIJabcdefghijklmnopqrstuvwx";
const LONG = `https://www.google.com/maps/place/Acme+Plumbing/@27.273,-80.358,17z/data=!3m1!4b1!4m6!3m5!1s${PLACE_ID}!8m2!3d27.273!4d-80.358`;

function card(placeId: string, name: string): PlaceCard {
  return { placeId, name, address: `${name} address`, phone: "772-555-0100", category: "Plumber", rating: 4.6, reviewCount: 12, website: "https://example.com" };
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "places-"));
  resetDbForTests(path.join(dir, "test.sqlite"));
  setSafeFetchDepsForTests(null);
});
afterEach(() => {
  setSafeFetchDepsForTests(null);
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("maps link parsing", () => {
  it("reads a place id and name from a long maps URL", () => {
    expect(parseMapsUrl(LONG)).toMatchObject({ placeId: PLACE_ID, text: "Acme Plumbing" });
  });

  it("reads a place id from a search URL and a place_id query", () => {
    expect(parseMapsUrl(`https://www.google.com/maps/search/?api=1&query=Acme+Plumbing+Port+St.+Lucie&query_place_id=${PLACE_ID}`)).toMatchObject({
      placeId: PLACE_ID,
      text: "Acme Plumbing Port St. Lucie",
    });
    expect(parseMapsUrl(`https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`).placeId).toBe(PLACE_ID);
  });

  it("reads a decimal CID and a CID embedded in the data parameter", () => {
    expect(parseMapsUrl("https://maps.google.com/?cid=1234567890123456789").cid).toBe("1234567890123456789");
    const parsed = parseMapsUrl("https://www.google.com/maps/place/Bay+Air/@27.2,-80.3,17z/data=!3m1!4b1!1s0x88de1234:0x1a2b3c4d!8m2!3d27.2!4d-80.3");
    expect(parsed.text).toBe("Bay Air");
    expect(parsed.cid).toBe(BigInt("0x1a2b3c4d").toString(10));
  });

  it("treats a typed name as text and garbage as text with no id", async () => {
    expect(await resolvePlaceTarget("Acme Plumbing, Port St. Lucie")).toEqual({ text: "Acme Plumbing, Port St. Lucie" });
    expect(await resolvePlaceTarget("%%% not a place !!!")).toEqual({ text: "%%% not a place !!!" });
    expect(parseMapsUrl("https://example.com/nothing")).toEqual({});
  });

  it("follows only an exact short-link host", async () => {
    const calls: string[] = [];
    setSafeFetchDepsForTests({
      resolve: async (hostname) => {
        calls.push(hostname);
        return [{ address: "142.250.190.14", family: 4 }];
      },
      request: async ({ url }) => {
        if (url.hostname === "maps.app.goo.gl") return { status: 302, headers: { location: LONG } };
        return { status: 200, headers: {} };
      },
    });
    expect(shortLinkHost("https://maps.app.goo.gl/AbCd")).toBe("maps.app.goo.gl");
    expect(shortLinkHost("https://goo.gl.evil.example/AbCd")).toBeNull();
    expect(shortLinkHost("https://evil.example/?q=goo.gl")).toBeNull();
    expect(await resolvePlaceTarget("https://goo.gl.evil.example/AbCd")).toEqual({});
    expect(calls).toEqual([]);
    expect(await resolvePlaceTarget("https://maps.app.goo.gl/AbCd")).toMatchObject({ placeId: PLACE_ID, text: "Acme Plumbing" });
    expect(calls).toContain("maps.app.goo.gl");
  });

  it("does not fetch a metadata address that merely mentions goo.gl", async () => {
    const calls: string[] = [];
    setSafeFetchDepsForTests({
      resolve: async () => {
        calls.push("resolve");
        return [{ address: "8.8.8.8", family: 4 }];
      },
      request: async () => {
        calls.push("request");
        return { status: 200, headers: {} };
      },
    });
    expect(await resolvePlaceTarget("http://169.254.169.254/?goo.gl")).toEqual({});
    expect(calls).toEqual([]);
  });
});

describe("safeFetch", () => {
  const publicDeps = (request: SafeFetchDeps["request"]): SafeFetchDeps => ({
    resolve: async () => [{ address: "8.8.8.8", family: 4 }],
    request,
  });

  it("identifies itself and blocks private, loopback, link-local, CGNAT, and metadata ranges", async () => {
    expect(SAFE_FETCH_USER_AGENT).toContain(brand.domain);
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.5", "192.168.1.9", "100.64.0.1", "100.100.100.200", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    const calls: string[] = [];
    setSafeFetchDepsForTests(publicDeps(async ({ url }) => {
      calls.push(url.hostname);
      return { status: 200, headers: {} };
    }));
    for (const raw of ["http://169.254.169.254/?goo.gl", "http://10.0.0.1/", "http://127.0.0.1/", "http://[::1]/", "http://[fe80::1]/", "http://[fc00::1]/", "http://[::ffff:127.0.0.1]/", "http://metadata.google.internal/", "ftp://example.com/a"]) {
      await expect(safeFetch(raw)).rejects.toMatchObject({ code: expect.stringMatching(/blocked|unsupported_url/) });
    }
    expect(calls).toEqual([]);
  });

  it("refuses a redirect onto a private or metadata address", async () => {
    const calls: string[] = [];
    setSafeFetchDepsForTests({
      resolve: async (hostname) => {
        if (hostname === "evil.example") return [{ address: "8.8.8.8", family: 4 }];
        throw new Error(`unexpected resolve ${hostname}`);
      },
      request: async ({ url }) => {
        calls.push(url.toString());
        return { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } };
      },
    });
    await expect(safeFetch("http://evil.example/start")).rejects.toMatchObject({ code: "blocked" });
    expect(calls).toEqual(["http://evil.example/start"]);

    calls.length = 0;
    setSafeFetchDepsForTests({
      resolve: async (hostname) => (hostname === "evil.example" ? [{ address: "8.8.8.8", family: 4 }] : [{ address: "10.1.2.3", family: 4 }]),
      request: async ({ url }) => {
        calls.push(url.hostname);
        return { status: 302, headers: { location: "http://internal.example/secret" } };
      },
    });
    await expect(safeFetch("http://evil.example/go")).rejects.toMatchObject({ code: "blocked" });
    expect(calls).toEqual(["evil.example"]);
  });

  it("stops after five redirects and rejects an oversized body", async () => {
    let hops = 0;
    setSafeFetchDepsForTests(publicDeps(async () => {
      hops += 1;
      return { status: 302, headers: { location: `http://example.com/${hops}` } };
    }));
    await expect(safeFetch("http://example.com/0")).rejects.toMatchObject({ code: "too_many_redirects" });
    expect(hops).toBe(6);

    setSafeFetchDepsForTests(publicDeps(async () => ({ status: 200, headers: {}, body: Buffer.alloc(SAFE_FETCH_MAX_BYTES + 1) })));
    await expect(safeFetch("http://example.com/big")).rejects.toMatchObject({ code: "body_too_large" });

    setSafeFetchDepsForTests(publicDeps(() => new Promise(() => undefined)));
    await expect(safeFetch("http://example.com/slow", { timeoutMs: 40 })).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("confirm step", () => {
  const primary = card("p1", "Acme");
  const alternates = [card("p2", "Two"), card("p3", "Three"), card("p4", "Four"), card("p5", "Five"), card("p6", "Six")];

  it("caps alternates at four and swaps the selected business", () => {
    const matched = showMatch(primary, alternates);
    expect(matched.step).toBe("confirm");
    expect(matched.selected?.placeId).toBe("p1");
    expect(matched.alternates.map((item) => item.placeId)).toEqual(["p2", "p3", "p4", "p5"]);
    const picked = pickAlternate(showAlternates(matched), "p4");
    expect(picked.selected?.placeId).toBe("p4");
    expect(picked.showingAlternates).toBe(false);
    expect(picked.alternates.map((item) => item.placeId)).toContain("p1");
    expect(picked.alternates).toHaveLength(4);
    const confirmed = confirmSelected(picked);
    expect(confirmed.step).toBe("confirmed");
    expect(backToConfirm(confirmed).step).toBe("confirm");
    expect(backToConfirm(confirmed).selected?.placeId).toBe("p4");
    expect(confirmSelected(startSearch()).step).toBe("search");
  });

  it("does not analyze until the place is confirmed, and can return to that step", async () => {
    run(
      "INSERT INTO prospects(id, status, stage, website, email, place_id, place_confirmed, source, created_at, updated_at) VALUES('pro_wait', 'matched', 'confirm', 'https://example.com', 'a@b.co', 'ChIJabcdefghij', 0, 'try', 't', 't')",
    );
    expect(analysisAllowed({ place_id: "ChIJabcdefghij", place_confirmed: 0 })).toBe(false);
    await runAnalysis("pro_wait");
    expect(get("SELECT status, stage, place_confirmed FROM prospects WHERE id = 'pro_wait'")).toEqual({
      status: "matched",
      stage: "confirm",
      place_confirmed: 0,
    });
    confirmProspectPlace("pro_wait", { placeId: "ChIJabcdefghij", website: "https://example.com", gbpInput: "Acme", trade: "plumbing", serviceArea: "Port St. Lucie" });
    expect(get<{ place_confirmed: number; status: string }>("SELECT place_confirmed, status FROM prospects WHERE id = 'pro_wait'")).toMatchObject({
      place_confirmed: 1,
      status: "analyzing",
    });
    saveSources("pro_wait", { ok: true, pages: [] }, {
      found: true,
      query: "Acme",
      placeId: "ChIJabcdefghij",
      name: "Secret Name",
      address: "1 Secret St",
      phone: "772-555-0199",
      reviews: [{ rating: 5, text: "a private review", when: "today" }],
    });
    const stored = String(get<{ sources_json: string }>("SELECT sources_json FROM prospects WHERE id = 'pro_wait'")?.sources_json);
    expect(stored).toContain("ChIJabcdefghij");
    expect(stored).not.toContain("Secret Name");
    expect(stored).not.toContain("private review");
    expect(stored).not.toContain("772-555-0199");
    expect(reopenProspectConfirm("pro_wait")).toBe(true);
    expect(get("SELECT status, place_confirmed, stage FROM prospects WHERE id = 'pro_wait'")).toEqual({
      status: "matched",
      place_confirmed: 0,
      stage: "confirm",
    });
  });

  it("requests only the place fields the card and the analysis use", () => {
    expect(PLACE_DETAIL_FIELD_MASK.split(",")).toEqual([
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
    ]);
    expect(TEXT_SEARCH_FIELD_MASK).not.toMatch(/review|photo|editorial|latitude|longitude/i);
    expect(PLACE_DETAIL_FIELD_MASK).not.toMatch(/review|photo|editorial|latitude|longitude/i);
  });
});
