import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests } from "../lib/db";
import { discoverLinks, extractPage, findingsForPage } from "../lib/upgrade/assess";
import { createUpgrade, executeUpgrade, upgradeView } from "../lib/upgrade/store";

const html = `<!doctype html><html><head><title>Cedarline Roofing</title></head><body>
  <h1>Roof repair</h1>
  <img src="/a.jpg">
  <a href="/contact">Contact</a>
  <a href="https://evil.example/quote">Outside</a>
</body></html>`;

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "upg-"));
  resetDbForTests(path.join(dir, "t.sqlite"));
});
afterEach(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("website assessment", () => {
  it("cites the fetched page and does not follow an off-site link", () => {
    const page = extractPage("https://cedar.example/", html);
    const findings = findingsForPage("https://cedar.example/", page, "2026-07-01T00:00:00.000Z");
    expect(findings.some((item) => item.area === "Mobile usability" && item.kind === "observed" && item.sourceUrl === "https://cedar.example/")).toBe(true);
    expect(findings.some((item) => item.found.includes("license"))).toBe(false);
    expect(discoverLinks(html, "https://cedar.example/")).toEqual(["https://cedar.example/contact"]);
  });

  it("stores a failed fetch without inventing findings about the business", async () => {
    const created = createUpgrade({
      websiteUrl: "https://cedar.example/",
      mapsUrl: null,
      businessName: null,
      industry: "roofing",
      goals: [],
      idempotencyKey: "k".repeat(20),
      clientHash: "hash",
    });
    const row = await executeUpgrade(created.id, async () => {
      throw new Error("down");
    });
    const view = upgradeView(row);
    expect(view.status).toBe("failed");
    expect(view.findings.some((item) => item.kind === "observed" && item.area !== "Business listing")).toBe(false);
    expect(view.preview.html).toContain("Sample layout");
  });
});
