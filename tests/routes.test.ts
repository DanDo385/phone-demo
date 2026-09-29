import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { redirectMap } from "@/redirects.mjs";

const APP = path.join(__dirname, "..", "app");

// URL pattern -> page file, with route groups stripped the way Next.js does.
function pages(dir = APP, segments: string[] = []): Map<string, string> {
  const found = new Map<string, string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      const next = /^\(.+\)$/.test(entry.name) ? segments : [...segments, entry.name];
      for (const [url, file] of pages(full, next)) {
        expect(found.has(url), `${url} is defined twice`).toBe(false);
        found.set(url, file);
      }
    } else if (entry.name === "page.tsx") {
      found.set(`/${segments.join("/")}`, path.relative(APP, full));
    }
  }
  return found;
}

function resolve(url: string, table: Map<string, string>): string | undefined {
  const parts = url.split("?")[0].split("/").filter(Boolean);
  for (const [pattern, file] of table) {
    const want = pattern.split("/").filter(Boolean);
    if (want.length === parts.length && want.every((seg, i) => /^\[.+\]$/.test(seg) || seg === parts[i])) return file;
  }
  return undefined;
}

describe("route groups", () => {
  const table = pages();

  it("keeps every demo URL the tests, docs, and emails use, inside (demo)", () => {
    const urls = ["/demo", "/try", "/try/p1", "/call", "/dashboard/prospects", "/c/tok", "/review/tok", "/renew", "/login", "/dashboard", "/dashboard/books", "/dashboard/crm", "/dashboard/crm/c1", "/dashboard/inquiries/i1"];
    for (const url of urls) {
      const file = resolve(url, table);
      expect(file, url).toBeDefined();
      expect(file!.startsWith("(demo)/"), `${url} -> ${file}`).toBe(true);
    }
  });

  it("gives each group its own root layout", () => {
    expect(fs.existsSync(path.join(APP, "(demo)", "layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(APP, "(marketing)", "layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(APP, "layout.tsx"))).toBe(false);
  });

  it("redirects only to pages that exist, and never shadows a page", () => {
    for (const entry of redirectMap) {
      expect(resolve(entry.destination, table), entry.destination).toBeDefined();
      expect(resolve(entry.source, table), `${entry.source} has a page; delete its redirect`).toBeUndefined();
    }
  });
});
