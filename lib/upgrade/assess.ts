// Turns fetched public HTML into observations, findings, a preview, and a profile package.
// Findings cite the page that was fetched. Nothing here invents licenses, reviews, or photos.

export type FindingKind = "observed" | "inferred" | "needs_owner";

export type Finding = {
  kind: FindingKind;
  area: string;
  severity: "high" | "medium" | "low";
  found: string;
  why: string;
  improve: string;
  sourceUrl: string | null;
  collectedAt: string;
};

export type Observation = {
  sourceUrl: string;
  collectedAt: string;
  finalUrl: string;
  status: number | null;
  title: string | null;
  note: string;
};

export type Extracted = {
  title: string | null;
  description: string | null;
  h1: string | null;
  headings: string[];
  phones: string[];
  emails: string[];
  imageCount: number;
  imagesMissingAlt: number;
  hasViewport: boolean;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  lang: string | null;
  https: boolean;
  actionLinks: string[];
  textSample: string;
  hoursMentioned: boolean;
};

export type PreviewModel = {
  label: string;
  name: string;
  nameSource: "visitor" | "page" | "unknown";
  description: string;
  headings: string[];
  phones: string[];
  html: string;
  changes: string[];
};

export type ProfilePackage = {
  authorization: string;
  description: string;
  services: string[];
  photoSuggestions: string[];
  links: string[];
  updates: string[];
};

const SAMPLE_BANNER = "Sample layout generated for review. This is not the live website, and it is not evidence of completed work.";

export function extractPage(pageUrl: string, html: string): Extracted {
  const title = attrText(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = metaContent(html, "description");
  const h1 = attrText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((match) => clean(match[1]))
    .filter(Boolean)
    .slice(0, 12);
  const phones = unique([...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((match) => decode(match[1]))).slice(0, 4);
  const emails = unique([...html.matchAll(/href=["']mailto:([^"'?]+)/gi)].map((match) => decode(match[1]))).slice(0, 4);
  const images = [...html.matchAll(/<img\b([^>]*)>/gi)];
  const missingAlt = images.filter((match) => !/\balt\s*=\s*["'][^"']+["']/i.test(match[1])).length;
  const lang = html.match(/<html[^>]*\blang=["']([^"']+)["']/i)?.[1]?.trim() || null;
  const jsonLdTypes = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
    try {
      return typesIn(JSON.parse(match[1]));
    } catch {
      return [];
    }
  });
  const actionLinks = unique(
    [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .filter((match) => /(contact|quote|estimat|book|schedule|appointment)/i.test(`${match[1]} ${clean(match[2])}`))
      .map((match) => clean(match[2]) || "link")
      .slice(0, 6),
  );
  const text = clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  let parsed: URL | null = null;
  try {
    parsed = new URL(pageUrl);
  } catch {
    parsed = null;
  }
  return {
    title,
    description,
    h1,
    headings,
    phones,
    emails,
    imageCount: images.length,
    imagesMissingAlt: missingAlt,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasJsonLd: jsonLdTypes.length > 0 || /application\/ld\+json/i.test(html),
    jsonLdTypes: unique(jsonLdTypes).slice(0, 8),
    lang,
    https: parsed?.protocol === "https:",
    actionLinks,
    textSample: text.slice(0, 500),
    hoursMentioned: /\b(business hours|opening hours|monday|mon(?:day)?\s*[-–]\s*fri|open\s+\d)/i.test(text),
  };
}

export function discoverLinks(html: string, base: string, limit = 3): string[] {
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>([baseUrl.toString()]);
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    let next: URL;
    try {
      next = new URL(match[1], baseUrl);
    } catch {
      continue;
    }
    if (next.origin !== baseUrl.origin || (next.protocol !== "http:" && next.protocol !== "https:")) continue;
    if (!/(contact|service|about|quote|estimat|book|appoint|project|gallery|commercial)/i.test(next.pathname)) continue;
    next.hash = "";
    const href = next.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    out.push(href);
    if (out.length >= limit) break;
  }
  return out;
}

export function findingsForPage(pageUrl: string, page: Extracted, collectedAt: string): Finding[] {
  const found: Finding[] = [];
  const add = (item: Omit<Finding, "sourceUrl" | "collectedAt">) => found.push({ ...item, sourceUrl: pageUrl, collectedAt });
  if (!page.hasViewport) {
    add({ kind: "observed", area: "Mobile usability", severity: "high", found: "The fetched page has no viewport meta element.", why: "Phones may show a desktop layout that is hard to use.", improve: "Add a viewport meta element and check the page at a phone width." });
  }
  if (page.actionLinks.length === 0) {
    add({ kind: "observed", area: "Calls to action", severity: "high", found: "The fetched page has no link whose text or address mentions contact, a quote, an estimate, or booking.", why: "A visitor who is ready to ask for work has no obvious next step.", improve: "Add a visible path to request an estimate or book a conversation." });
  }
  if (page.phones.length === 0 && page.emails.length === 0) {
    add({ kind: "observed", area: "Contact", severity: "high", found: "The fetched page has no telephone or email link.", why: "People who want to call or write have to hunt for a way to do it.", improve: "Put a telephone link and an email link where a visitor can see them." });
  }
  if (!page.h1) {
    add({ kind: "observed", area: "Service clarity", severity: "medium", found: "The fetched page has no H1 heading.", why: "The first heading is what tells a visitor, and a search engine, what the page is about.", improve: "Give the page one H1 that names the business and the work." });
  }
  if (!page.hoursMentioned) {
    add({ kind: "observed", area: "Hours", severity: "medium", found: "The fetched text does not include a recognizable hours line.", why: "A caller cannot tell when someone will answer.", improve: "Publish hours on the website and confirm they match the business listing." });
  }
  if (page.imageCount < 2) {
    add({ kind: "inferred", area: "Project photos", severity: "medium", found: `The fetched page includes ${page.imageCount} image${page.imageCount === 1 ? "" : "s"}.`, why: "Service businesses are easier to trust when a visitor can see real work. This count alone does not prove the photos are projects.", improve: "Add photos of work you have permission to show, with a short caption for each." });
  }
  if (page.imagesMissingAlt > 0) {
    add({ kind: "observed", area: "Accessibility", severity: "medium", found: `${page.imagesMissingAlt} image${page.imagesMissingAlt === 1 ? "" : "s"} on the fetched page ${page.imagesMissingAlt === 1 ? "has" : "have"} no text alternative.`, why: "People using a screen reader, and search tools, cannot tell what the image shows.", improve: "Describe each meaningful image. Mark decorative images as decorative." });
  }
  if (!page.title || !page.description) {
    add({ kind: "observed", area: "Basic SEO", severity: "medium", found: `${page.title ? "A title is present." : "No title element was found."} ${page.description ? "A meta description is present." : "No meta description was found."}`, why: "Search results use the title and description to decide whether the page is worth opening.", improve: "Write a specific title and description from the services you actually offer." });
  }
  if (!page.hasJsonLd) {
    add({ kind: "observed", area: "Structured data", severity: "low", found: "The fetched page has no JSON-LD structured data.", why: "Structured data can help search tools understand the business name, hours, and service.", improve: "Add LocalBusiness data that matches the public facts. Do not add a rating you cannot support." });
  } else {
    add({ kind: "observed", area: "Structured data", severity: "low", found: `JSON-LD types on the fetched page: ${page.jsonLdTypes.join(", ") || "present, type not read"}.`, why: "The types should match the visible business facts.", improve: "Check that the structured name, hours, and telephone match the page and the listing." });
  }
  if (!page.https) {
    add({ kind: "observed", area: "Security", severity: "high", found: "The fetched address is not HTTPS.", why: "Browsers warn visitors, and form details are easier to expose.", improve: "Serve the site over HTTPS with a current certificate." });
  }
  if (!page.lang) {
    add({ kind: "observed", area: "Accessibility", severity: "low", found: "The fetched page does not set a language on the html element.", why: "Screen readers guess the language when it is missing.", improve: "Set the page language, and add another language only when that version exists." });
  }
  return found;
}

export function listingFindings(mapsUrl: string | null, collectedAt: string): Finding[] {
  if (!mapsUrl) {
    return [{
      kind: "needs_owner",
      area: "Business listing",
      severity: "medium",
      found: "No Google profile or Maps link was provided.",
      why: "The website and the listing can disagree, and this assessment cannot see a listing it was not given.",
      improve: "Add the public profile link. Changing the listing still requires an owner-authorized connection.",
      sourceUrl: null,
      collectedAt,
    }];
  }
  return [{
    kind: "needs_owner",
    area: "Business listing",
    severity: "medium",
    found: "A public profile link was provided. The listing contents were not read or changed.",
    why: "Hours, categories, photos, and reviews on the listing can disagree with the website. A public URL is not permission to edit the listing.",
    improve: "Compare the listing with the website after an owner-authorized connection. Apply only the updates that match the facts.",
    sourceUrl: mapsUrl,
    collectedAt,
  }];
}

export function buildPreview(input: {
  websiteUrl: string;
  businessName: string | null;
  pages: Extracted[];
  findings: Finding[];
}): PreviewModel {
  const page = input.pages[0];
  const name = input.businessName?.trim() || page?.title || page?.h1 || "";
  const nameSource: PreviewModel["nameSource"] = input.businessName?.trim() ? "visitor" : name ? "page" : "unknown";
  const displayName = name || "Business name not confirmed";
  const description = page?.description || page?.h1 || "A description will be written from pages you approve. None was extracted here.";
  const headings = unique(input.pages.flatMap((item) => item.headings)).slice(0, 6);
  const phones = unique(input.pages.flatMap((item) => item.phones)).slice(0, 2);
  const changes = unique(input.findings.map((item) => item.improve));
  const serviceBlocks = headings.length
    ? headings.map((heading) => `<section><h2>${esc(heading)}</h2><p>Shown because this heading was on a fetched page. Confirm it is a service you still offer before this page is published.</p></section>`).join("")
    : `<section><h2>Services</h2><p class="sample">Sample section. No service list was extracted, so none is invented here.</p></section>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(displayName)}</title><style>
    body{margin:0;font:16px/1.5 Georgia,serif;color:#101828;background:#f6f7f9}
    header,main,footer{padding:20px} header{background:#101828;color:#fff}
    .banner{background:#eaf0ff;color:#101828;padding:12px 20px;font:14px/1.4 system-ui,sans-serif}
    a.btn,button{display:inline-block;margin:8px 8px 0 0;padding:12px 16px;background:#1f5eff;color:#fff;border-radius:10px;text-decoration:none;border:0;font:inherit}
    .grid{display:grid;gap:12px} @media(min-width:700px){.grid{grid-template-columns:1fr 1fr}}
    section,form,aside{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:16px}
    .sample{font-style:italic}
  </style></head><body>
    <p class="banner">${esc(SAMPLE_BANNER)}</p>
    <header><h1>${esc(displayName)}</h1><p>${esc(description)}</p>
      <a class="btn" href="#lead">Request an estimate</a>
      <a class="btn" href="#chat">Message</a>
      ${phones[0] ? `<a class="btn" href="tel:${esc(phones[0])}">Call</a>` : ""}
      ${phones[0] ? "" : `<p class="sample">No telephone number was extracted, so this preview does not invent one.</p>`}
    </header>
    <main class="grid">
      ${serviceBlocks}
      <form id="lead"><h2>Request an estimate</h2><p class="sample">Sample form. It does not send this preview anywhere.</p><label>What do you need?<br><input name="need" style="width:100%;padding:8px"></label></form>
      <aside id="chat"><h2>Chat</h2><p class="sample">Sample chatbot. On a launched site it uses the same business knowledge as the phone receptionist. It does not answer from this preview.</p></aside>
      <section><h2>Work</h2><p class="sample">Portfolio placeholder. Fetched images are not copied into this preview. Project photos are added only with permission.</p></section>
      <section><h2>Existing customer</h2><p><a href="#account">Sign in</a></p><p class="sample">Sample account link. A launched site sends a magic link or one-time code to a verified contact. A name or invoice number alone does not sign anyone in.</p></section>
    </main>
    <footer><p>Preview based on ${esc(input.websiteUrl)}. Not published.</p></footer>
  </body></html>`;
  return { label: SAMPLE_BANNER, name: displayName, nameSource, description, headings, phones, html, changes };
}

export function buildProfile(input: { websiteUrl: string; mapsUrl: string | null; preview: PreviewModel; findings: Finding[] }): ProfilePackage {
  const services = input.preview.headings.length
    ? input.preview.headings.map((heading) => `Extracted heading, confirm before use: ${heading}`)
    : ["No service list was extracted. Do not publish invented services."];
  const description = input.preview.nameSource === "unknown"
    ? "Not drafted. The fetched pages did not confirm a business name we can describe."
    : `Draft for review. Not published. ${input.preview.name}. ${input.preview.description}`;
  return {
    authorization: "This package is separate from the website preview. A public profile link starts the assessment. Nothing here is written to the live listing. An owner-authorized connection is required before any listing change.",
    description,
    services,
    photoSuggestions: [
      "A photo of the crew or the office that you have the right to publish.",
      "Before-and-after photos of jobs whose property owners gave permission.",
      "A clear photo of the service you want found in search, without a claim you cannot support.",
    ],
    links: [input.websiteUrl, input.mapsUrl].filter((item): item is string => Boolean(item)),
    updates: input.findings.filter((item) => item.area === "Hours" || item.area === "Contact" || item.area === "Business listing" || item.area === "Service clarity").map((item) => item.improve),
  };
}

function typesIn(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(typesIn);
  const record = value as { "@type"?: unknown };
  const own = record["@type"];
  const types = Array.isArray(own) ? own.map(String) : own ? [String(own)] : [];
  return types;
}

function metaContent(html: string, name: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i"))?.[0];
  if (!tag) return null;
  return clean(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "") || null;
}

function attrText(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? clean(match[1]) || null : null;
}

function clean(value: string): string {
  return decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decode(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
