import { all, get, run, transaction } from "../db";
import { SHOWCASE } from "./ids";
import { generateContentOptions } from "./workflow";

export { SHOWCASE };

const NOW = "2026-07-15T15:00:00.000Z";

export function ensureShowcase(): void {
  if (!get("SELECT id FROM businesses WHERE id = ?", SHOWCASE.roofing)) transaction(() => {
    run(
      `INSERT INTO businesses(id, name, fictional, industry, review_url, review_policy, languages_tested_json, created_at)
       VALUES (?, 'Cedarline Roofing', 1, 'roofing', 'https://example.com/review/cedarline-fictional', 'Neutral invitation after payment. No incentive. The customer writes the review.', '[]', ?)`,
      SHOWCASE.roofing,
      NOW,
    );
    run(
      `INSERT INTO businesses(id, name, fictional, industry, review_url, languages_tested_json, created_at)
       VALUES (?, 'Northmill Facilities', 1, 'industrial', NULL, '[]', ?)`,
      SHOWCASE.northmill,
      NOW,
    );
    run("INSERT INTO customer_accounts(id, business_id, name, email, phone, created_at) VALUES (?, ?, 'Maya Ellison', 'maya.ellison@example.com', '+15555550121', ?)", SHOWCASE.maya, SHOWCASE.roofing, NOW);
    run("INSERT INTO customer_accounts(id, business_id, name, email, phone, created_at) VALUES (?, ?, 'Sam Patel', 'sam.patel@example.com', '+15555550122', ?)", SHOWCASE.sam, SHOWCASE.roofing, NOW);
    run("INSERT INTO customer_accounts(id, business_id, name, email, created_at) VALUES ('cus_chris_dalton', ?, 'Chris Dalton', 'chris.dalton@example.com', ?)", SHOWCASE.northmill, NOW);
    run("INSERT INTO customer_accounts(id, business_id, name, email, created_at) VALUES ('cus_priya_shah', ?, 'Priya Shah', 'priya.shah@example.com', ?)", SHOWCASE.northmill, NOW);
    run(
      `INSERT INTO ops_inquiries(id, business_id, customer_id, channel, status, priority, priority_reason, summary, facts_json, language, created_at, updated_at)
       VALUES (?, ?, ?, 'phone', 'booked', 'high', 'Commercial leak, urgent. Priority follows fit and timing. The stated value is not booked revenue.', 'Warehouse roof leak', ?, 'en', ?, ?)`,
      SHOWCASE.inquiry,
      SHOWCASE.roofing,
      SHOWCASE.maya,
      JSON.stringify({ commercial: true, urgency: "soon", audience: "commercial", statedValueLabel: "Illustrative sample, not booked revenue", contacts: [{ name: "Maya Ellison", role: "Facilities manager" }] }),
      NOW,
      NOW,
    );
    run(
      `INSERT INTO ops_inquiries(id, business_id, customer_id, channel, status, priority, priority_reason, summary, facts_json, language, created_at, updated_at)
       VALUES (?, ?, 'cus_chris_dalton', 'email', 'open', 'high', 'RFP with two contacts and a requested site walk. Stated project value is not booked revenue.', 'Plant roof replacement RFP', ?, 'en', ?, ?)`,
      SHOWCASE.northInquiry,
      SHOWCASE.northmill,
      JSON.stringify({ rfp: true, commercial: true, contacts: [{ name: "Chris Dalton", role: "Procurement" }, { name: "Priya Shah", role: "Plant engineer" }], statedValueLabel: "Illustrative sample, not booked revenue" }),
      NOW,
      NOW,
    );
    run(
      `INSERT INTO ops_messages(id, business_id, inquiry_id, channel, direction, body, delivery, delivery_reason, created_at)
       VALUES ('msg_cedar_in', ?, ?, 'phone', 'in', 'A section of our warehouse roof is leaking. We need someone this week.', 'simulated', 'Sample transcript, not a carrier call.', ?)`,
      SHOWCASE.roofing,
      SHOWCASE.inquiry,
      NOW,
    );
    run(
      `INSERT INTO ops_appointments(id, business_id, inquiry_id, starts_at, ends_at, kind, status, idempotency_key, provider, created_at)
       VALUES ('apt_cedarline', ?, ?, '2026-07-16T14:00:00.000Z', '2026-07-16T15:00:00.000Z', 'site_visit', 'booked', 'cedarline-visit', 'simulated', ?)`,
      SHOWCASE.roofing,
      SHOWCASE.inquiry,
      NOW,
    );
    run("INSERT INTO ops_jobs(id, business_id, inquiry_id, title, stage, notes, created_at, updated_at) VALUES (?, ?, ?, 'Warehouse roof leak', 'paid', 'Replaced the damaged section. No warranty was promised beyond the note in the proposal.', ?, ?)", SHOWCASE.job, SHOWCASE.roofing, SHOWCASE.inquiry, NOW, NOW);
    run("INSERT INTO ops_jobs(id, business_id, inquiry_id, title, stage, notes, created_at, updated_at) VALUES (?, ?, ?, 'Plant roof RFP', 'visit_booked', 'Drawings requested. Site walk not complete.', ?, ?)", SHOWCASE.northJob, SHOWCASE.northmill, SHOWCASE.northInquiry, NOW, NOW);
    run(
      `INSERT INTO ops_appointments(id, business_id, inquiry_id, starts_at, ends_at, kind, status, idempotency_key, provider, created_at)
       VALUES ('apt_northmill', ?, ?, '2026-07-18T15:00:00.000Z', '2026-07-18T16:30:00.000Z', 'site_visit', 'booked', 'northmill-walk', 'simulated', ?)`,
      SHOWCASE.northmill,
      SHOWCASE.northInquiry,
      NOW,
    );
    run(
      `INSERT INTO ops_estimates(id, business_id, inquiry_id, job_id, status, summary, amount_label, illustrative, created_at)
       VALUES ('est_cedarline', ?, ?, ?, 'approved', 'Illustrative proposal for the damaged section. Not a client invoice.', 'Illustrative sample, not a quote', 1, ?)`,
      SHOWCASE.roofing,
      SHOWCASE.inquiry,
      SHOWCASE.job,
      NOW,
    );
    run(
      `INSERT INTO ops_invoices(id, business_id, customer_id, job_id, external_ref, amount_label, status, source_system, illustrative, created_at)
       VALUES (?, ?, ?, ?, 'SAMPLE-100', 'Illustrative sample, not money due', 'issued', 'sample-ledger', 1, ?)`,
      SHOWCASE.mayaInvoice,
      SHOWCASE.roofing,
      SHOWCASE.maya,
      SHOWCASE.job,
      NOW,
    );
    run(
      `INSERT INTO ops_invoices(id, business_id, customer_id, job_id, external_ref, amount_label, status, source_system, illustrative, created_at)
       VALUES (?, ?, ?, NULL, 'SAMPLE-200', 'Illustrative sample for a different customer', 'issued', 'sample-ledger', 1, ?)`,
      SHOWCASE.samInvoice,
      SHOWCASE.roofing,
      SHOWCASE.sam,
      NOW,
    );
    run(
      `INSERT INTO ops_payments(id, business_id, invoice_id, status, source, amount_label, idempotency_key, created_at)
       VALUES ('pay_cedarline', ?, ?, 'confirmed', 'authorized_action', 'Illustrative sample, not a processor event', 'cedarline-pay', ?)`,
      SHOWCASE.roofing,
      SHOWCASE.mayaInvoice,
      NOW,
    );
    run("UPDATE ops_invoices SET status = 'paid' WHERE id = ?", SHOWCASE.mayaInvoice);
    run(
      `INSERT INTO ops_reviews(id, business_id, job_id, customer_id, status, review_url, created_at, updated_at)
       VALUES ('rev_cedarline', ?, ?, ?, 'sent', 'https://example.com/review/cedarline-fictional', ?, ?)`,
      SHOWCASE.roofing,
      SHOWCASE.job,
      SHOWCASE.maya,
      NOW,
      NOW,
    );
  });
  const existing = get("SELECT id FROM ops_content WHERE job_id = ?", SHOWCASE.job);
  if (!existing) {
    const generated = generateContentOptions({ businessId: SHOWCASE.roofing, jobId: SHOWCASE.job, actor: "showcase" });
    if (generated.ok) run("UPDATE ops_content SET id = ?, status = 'approved' WHERE id = ?", SHOWCASE.content, generated.ids[0]);
  }
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function showcaseSnapshot() {
  ensureShowcase();
  return toPlain({
    roofing: business(SHOWCASE.roofing),
    commercial: business(SHOWCASE.northmill),
    inquiries: all<{ id: string; business_id: string; summary: string; priority: string; priority_reason: string; channel: string; language: string; status: string }>("SELECT id, business_id, summary, priority, priority_reason, channel, language, status FROM ops_inquiries WHERE business_id IN (?, ?) ORDER BY created_at", SHOWCASE.roofing, SHOWCASE.northmill),
    messages: all<{ id: string; inquiry_id: string; channel: string; direction: string; body: string; delivery: string; delivery_reason: string | null }>("SELECT id, inquiry_id, channel, direction, body, delivery, delivery_reason FROM ops_messages WHERE business_id = ? ORDER BY created_at", SHOWCASE.roofing),
    appointments: all<{ id: string; business_id: string; inquiry_id: string; starts_at: string; status: string; provider: string }>("SELECT id, business_id, inquiry_id, starts_at, status, provider FROM ops_appointments WHERE business_id IN (?, ?)", SHOWCASE.roofing, SHOWCASE.northmill),
    jobs: all<{ id: string; business_id: string; title: string; stage: string; notes: string | null }>("SELECT id, business_id, title, stage, notes FROM ops_jobs WHERE business_id IN (?, ?)", SHOWCASE.roofing, SHOWCASE.northmill),
    files: all<{ id: string; business_id: string; inquiry_id: string | null; job_id: string | null; filename: string; permission: string }>("SELECT id, business_id, inquiry_id, job_id, filename, permission FROM ops_files WHERE business_id IN (?, ?)", SHOWCASE.roofing, SHOWCASE.northmill),
    content: all<{ id: string; job_id: string; status: string; concept_json: string }>("SELECT id, job_id, status, concept_json FROM ops_content WHERE business_id = ?", SHOWCASE.roofing).map((row) => ({
      id: row.id,
      jobId: row.job_id,
      status: row.status,
      concept: JSON.parse(row.concept_json) as { hook: string; platform: string; cost: string; why: string },
    })),
    publications: all<{ content_id: string; status: string; detail: string; url: string | null }>("SELECT content_id, status, detail, url FROM ops_publications WHERE business_id = ?", SHOWCASE.roofing),
    customers: [
      { id: SHOWCASE.maya, name: "Maya Ellison" },
      { id: SHOWCASE.sam, name: "Sam Patel" },
    ],
    invoices: { maya: SHOWCASE.mayaInvoice, sam: SHOWCASE.samInvoice },
  });
}

function business(id: string) {
  return get<{ id: string; name: string; industry: string }>("SELECT id, name, industry FROM businesses WHERE id = ?", id);
}
