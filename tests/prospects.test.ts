import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, resetDbForTests } from "../lib/db";
import { catalogRecords, prospectCounts, rankProspects } from "../lib/prospects";
import { ensureSeed } from "../lib/seed";
import { setAskForTests, type JevAnswer } from "../lib/scoring";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "palmetto-prospects-"));
  process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
  process.env.SCHEDULER_DISABLED = "1";
  resetDbForTests(process.env.DATABASE_PATH);
  ensureSeed();
});

afterEach(() => {
  setAskForTests(null);
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("company outreach ranking", () => {
  it("builds a large fictional catalog and drops companies that already have a website", async () => {
    expect(catalogRecords().length).toBe(160);
    expect(catalogRecords().some((row) => row.website)).toBe(true);
    const counts = prospectCounts();
    expect(counts.total).toBe(160);
    expect(counts.withoutWebsite).toBe(128);
    const ranked = await rankProspects("spanish plumbing");
    expect(ranked.mode).toBe("rules");
    expect(ranked.rows).toHaveLength(128);
    expect(ranked.rows.every((row) => !row.website)).toBe(true);
    expect(ranked.rows[0].trade).toBe("plumbing");
    expect(ranked.rows[0].spanish).toBe(1);
    expect(ranked.excludedWithWebsite).toBe(32);
  });

  it("sorts every no-website company from one Jev choice", async () => {
    let optionIds: string[] = [];
    setAskForTests(async (_state, questions) => {
      const criteria = (questions.where as { criteria: Record<string, null> }).criteria;
      optionIds = Object.keys(criteria);
      const favored = optionIds.find((id) => id === "p017") || optionIds[0];
      const probabilities: Record<string, number> = {};
      for (const id of optionIds) probabilities[id] = id === favored ? 0.4 : 0.6 / (optionIds.length - 1);
      const answers: Record<string, JevAnswer> = {
        where: { type: "choice", choice: favored, probabilities, confidence: 0.4 },
        matches: { type: "noul", noul: 0.92 },
      };
      return { model: "jev-test", answers };
    });
    const ranked = await rankProspects("independent plumbing shops");
    expect(ranked.mode).toBe("jev");
    expect(ranked.model).toBe("jev-test");
    expect(optionIds).toHaveLength(128);
    expect(optionIds.every((id) => catalogRecords().find((row) => row.id === id)?.website == null)).toBe(true);
    expect(ranked.rows[0].id).toBe("p017");
    expect(ranked.matchLabel).toMatch(/has a company/);
  });

  it("narrows in code before a Choice when the no-website list exceeds the option limit", async () => {
    let optionCount = 0;
    setAskForTests(async (_state, questions) => {
      optionCount = Object.keys((questions.where as { criteria: Record<string, null> }).criteria).length;
      const answers: Record<string, JevAnswer> = {
        where: { type: "choice", choice: "p002", probabilities: { p002: 1 }, confidence: 1 },
        matches: { type: "noul", noul: 0.2 },
      };
      return { model: "jev-test", answers };
    });
    const ranked = await rankProspects("spanish plumbing", { maxOptions: 5 });
    expect(optionCount).toBe(5);
    expect(ranked.narrowed).toBe(true);
    expect(ranked.considered).toBe(5);
    expect(ranked.rows).toHaveLength(5);
    expect(ranked.matchLabel).toMatch(/closest record/);
  });
});
