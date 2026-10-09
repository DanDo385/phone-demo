import { discoverLinks, buildPreview, buildProfile, extractPage, findingsForPage, listingFindings, type Finding, type Observation, type PreviewModel, type ProfilePackage } from "./assess";
import { get, run, transaction } from "../db";
import { id, sha256 } from "../ids";
import { safeFetch, SafeFetchError } from "../safeFetch";

export const UPGRADE_PER_HOUR = 8;
const MAX_PAGES = 4;

export type UpgradeInput = {
  websiteUrl: string;
  mapsUrl: string | null;
  businessName: string | null;
  industry: string | null;
  goals: string[];
  idempotencyKey: string;
  clientHash: string;
};

export type UpgradeRow = {
  id: string;
  status: string;
  website_url: string;
  maps_url: string | null;
  business_name: string | null;
  industry: string | null;
  goals_json: string;
  contact_email: string | null;
  observations_json: string;
  findings_json: string;
  preview_json: string;
  profile_json: string;
  changes_json: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type PageFetcher = (url: string) => Promise<{ status: number; finalUrl: string; html: string }>;

export function clientHash(ip: string): string {
  return sha256(`${process.env.CALLER_HASH_SALT || "upgrade"}:${ip}`);
}

export function recentUpgrades(hash: string, sinceIso: string): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM upgrade_audits WHERE client_hash = ? AND created_at >= ?", hash, sinceIso)?.n ?? 0;
}

export function upgradeById(auditId: string): UpgradeRow | undefined {
  return get<UpgradeRow>("SELECT * FROM upgrade_audits WHERE id = ?", auditId);
}

export function createUpgrade(input: UpgradeInput): { id: string; duplicate: boolean } {
  const existing = get<{ id: string }>("SELECT id FROM upgrade_audits WHERE idempotency_key = ?", input.idempotencyKey);
  if (existing) return { id: existing.id, duplicate: true };
  const now = new Date().toISOString();
  const auditId = id("upg");
  run(
    `INSERT INTO upgrade_audits(id, idempotency_key, status, website_url, maps_url, business_name, industry, goals_json, client_hash, created_at, updated_at)
     VALUES (?, ?, 'collecting', ?, ?, ?, ?, ?, ?, ?, ?)`,
    auditId,
    input.idempotencyKey,
    input.websiteUrl,
    input.mapsUrl,
    input.businessName,
    input.industry,
    JSON.stringify(input.goals),
    input.clientHash,
    now,
    now,
  );
  return { id: auditId, duplicate: false };
}

export async function executeUpgrade(auditId: string, fetcher: PageFetcher = fetchPublicPage): Promise<UpgradeRow> {
  const row = upgradeById(auditId);
  if (!row) throw new Error("Assessment not found");
  if (row.status === "ready" || row.status === "failed") return row;
  const collectedAt = new Date().toISOString();
  const observations: Observation[] = [];
  const findings: Finding[] = [];
  const pages = [];
  try {
    const first = await fetcher(row.website_url);
    observations.push(observe(row.website_url, first, collectedAt));
    const extracted = extractPage(first.finalUrl, first.html);
    pages.push(extracted);
    findings.push(...findingsForPage(first.finalUrl, extracted, collectedAt));
    for (const link of discoverLinks(first.html, first.finalUrl, MAX_PAGES - 1)) {
      try {
        const next = await fetcher(link);
        observations.push(observe(link, next, collectedAt));
        const extra = extractPage(next.finalUrl, next.html);
        pages.push(extra);
        findings.push(...findingsForPage(next.finalUrl, extra, collectedAt));
      } catch (error) {
        observations.push({ sourceUrl: link, collectedAt, finalUrl: link, status: null, title: null, note: fetchNote(error) });
      }
    }
    findings.push(...listingFindings(row.maps_url, collectedAt));
    if (row.maps_url) {
      observations.push({ sourceUrl: row.maps_url, collectedAt, finalUrl: row.maps_url, status: null, title: null, note: "Supplied by the visitor. The listing was not fetched or changed." });
    }
    const inconsistent = pages.length > 1 && pages[0].phones[0] && pages[1].phones[0] && pages[0].phones[0] !== pages[1].phones[0];
    if (inconsistent) {
      findings.push({
        kind: "observed",
        area: "Consistency",
        severity: "medium",
        found: "Telephone links differ across the pages that were fetched.",
        why: "A visitor or a searcher can reach the wrong number.",
        improve: "Use one published number on the website and on the business listing.",
        sourceUrl: row.website_url,
        collectedAt,
      });
    }
    const preview = buildPreview({ websiteUrl: row.website_url, businessName: row.business_name, pages, findings });
    const profile = buildProfile({ websiteUrl: row.website_url, mapsUrl: row.maps_url, preview, findings });
    save(auditId, "ready", observations, findings, preview, profile, null);
  } catch (error) {
    findings.push(...listingFindings(row.maps_url, collectedAt));
    save(auditId, "failed", observations, findings, emptyPreview(row.website_url), buildProfile({ websiteUrl: row.website_url, mapsUrl: row.maps_url, preview: emptyPreview(row.website_url), findings }), fetchNote(error));
  }
  return upgradeById(auditId)!;
}

export function retryUpgrade(auditId: string): boolean {
  const row = upgradeById(auditId);
  if (!row) return false;
  const now = new Date().toISOString();
  run("UPDATE upgrade_audits SET status = 'collecting', error = NULL, updated_at = ? WHERE id = ?", now, auditId);
  return true;
}

export function saveUpgradeContact(auditId: string, email: string): boolean {
  const row = upgradeById(auditId);
  if (!row) return false;
  run("UPDATE upgrade_audits SET contact_email = ?, updated_at = ? WHERE id = ?", email, new Date().toISOString(), auditId);
  return true;
}

export function upgradeView(row: UpgradeRow) {
  const findings = JSON.parse(row.findings_json) as Finding[];
  const preview = JSON.parse(row.preview_json) as PreviewModel;
  const profile = JSON.parse(row.profile_json) as ProfilePackage;
  return {
    id: row.id,
    status: row.status,
    websiteUrl: row.website_url,
    mapsUrl: row.maps_url,
    businessName: row.business_name,
    industry: row.industry,
    goals: JSON.parse(row.goals_json) as string[],
    error: row.error,
    observations: JSON.parse(row.observations_json) as Observation[],
    findings,
    preview,
    profile,
    changes: JSON.parse(row.changes_json) as string[],
    contactSaved: Boolean(row.contact_email),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchPublicPage(url: string): Promise<{ status: number; finalUrl: string; html: string }> {
  const response = await safeFetch(url, { timeoutMs: 8000 });
  return { status: response.status, finalUrl: response.url, html: response.body.toString("utf8").slice(0, 200_000) };
}

function observe(sourceUrl: string, page: { status: number; finalUrl: string; html: string }, collectedAt: string): Observation {
  return {
    sourceUrl,
    collectedAt,
    finalUrl: page.finalUrl,
    status: page.status,
    title: extractPage(page.finalUrl, page.html).title,
    note: page.status >= 200 && page.status < 400 ? "Fetched public page." : `HTTP ${page.status}`,
  };
}

function save(auditId: string, status: string, observations: Observation[], findings: Finding[], preview: PreviewModel, profile: ProfilePackage, error: string | null): void {
  transaction(() => {
    run(
      `UPDATE upgrade_audits SET status = ?, observations_json = ?, findings_json = ?, preview_json = ?, profile_json = ?, changes_json = ?, error = ?, updated_at = ? WHERE id = ?`,
      status,
      JSON.stringify(observations),
      JSON.stringify(findings),
      JSON.stringify(preview),
      JSON.stringify(profile),
      JSON.stringify(preview.changes),
      error,
      new Date().toISOString(),
      auditId,
    );
  });
}

function emptyPreview(websiteUrl: string): PreviewModel {
  return buildPreview({ websiteUrl, businessName: null, pages: [], findings: [] });
}

function fetchNote(error: unknown): string {
  if (error instanceof SafeFetchError) return `The page could not be fetched (${error.code}).`;
  return "The page could not be fetched.";
}
