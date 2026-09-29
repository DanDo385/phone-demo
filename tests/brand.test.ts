import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brand, plans } from "../lib/brand";

const ROOT = path.join(__dirname, "..");
// Brand values live in lib/brand.ts. Palmetto Coast copy is fictional and exempt, but it
// never mentions the company anyway, so it is scanned too.
const SCAN = ["app", "components", "content", "lib"];
const EXEMPT = new Set([path.join("lib", "brand.ts")]);

function files(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return files(rel);
    return /\.(tsx?|css|mjs)$/.test(e.name) && !EXEMPT.has(rel) ? [rel] : [];
  });
}

describe("brand values", () => {
  it("are not hardcoded outside lib/brand.ts", () => {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const words = [brand.company.name, brand.company.shortName, brand.products.scribe, brand.products.squire, brand.domain];
    const prices = plans.flatMap((p) => (p.monthlyUsd === null ? [] : [String(p.monthlyUsd)]));
    const patterns = [
      ...words.map((w) => new RegExp(`\\b${escape(w)}\\b`)),
      ...prices.map((n) => new RegExp(`\\$\\s?${n}\\b|\\b${n}\\s?/\\s?mo`)),
    ];
    const hits: string[] = [];
    for (const file of SCAN.flatMap(files)) {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      text.split("\n").forEach((line, i) => {
        if (patterns.some((re) => re.test(line))) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
