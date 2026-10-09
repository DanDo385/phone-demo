import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, get, resetDbForTests } from "../lib/db";
import { SHOWCASE } from "../lib/ops/ids";
import { ensureShowcase } from "../lib/ops/showcase";
import {
  attachMedia,
  bookAppointment,
  checkAvailability,
  confirmPayment,
  createBusiness,
  createCustomer,
  createInquiry,
  createJob,
  finishVerification,
  generateContentOptions,
  lookupAuthorizedInvoice,
  publishContent,
  recordInvoice,
  approveContent,
  requestReview,
  sendCustomerMessage,
  startVerification,
  updateJob,
} from "../lib/ops/workflow";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ops-"));
  resetDbForTests(path.join(dir, "t.sqlite"));
  process.env.OPS_FILES_DIR = path.join(dir, "files");
});

afterEach(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.OPS_FILES_DIR;
});

function world() {
  const business = createBusiness({ name: "Cedarline", fictional: true, industry: "roofing", reviewUrl: "https://example.com/review" });
  const other = createBusiness({ name: "Other", fictional: true, industry: "solar" });
  const maya = createCustomer({ businessId: business, name: "Maya", email: "maya@example.com" });
  const sam = createCustomer({ businessId: business, name: "Sam", email: "sam@example.com" });
  const inquiry = createInquiry({ businessId: business, customerId: maya, channel: "phone", summary: "Leak", facts: { commercial: true, urgency: "soon" } });
  if (!inquiry.ok) throw new Error(inquiry.error);
  return { business, other, maya, sam, inquiryId: inquiry.id };
}

describe("shared operations", () => {
  it("keeps a booking idempotent and refuses a second booking of the same time", () => {
    const { business, inquiryId } = world();
    const slots = checkAvailability(business, new Date("2026-07-13T12:00:00.000Z"));
    if (!Array.isArray(slots)) throw new Error("expected slots");
    const first = bookAppointment({ businessId: business, inquiryId, ...slots[0], kind: "site_visit", idempotencyKey: "book-1" });
    const replay = bookAppointment({ businessId: business, inquiryId, ...slots[0], kind: "site_visit", idempotencyKey: "book-1" });
    const clash = bookAppointment({ businessId: business, inquiryId, ...slots[0], kind: "site_visit", idempotencyKey: "book-2" });
    expect(first.ok && replay.ok && first.id === replay.id && replay.duplicate).toBe(true);
    expect(clash.ok).toBe(false);
  });

  it("does not reveal another customer's invoice", () => {
    const { business, other, maya, sam, inquiryId } = world();
    const job = createJob({ businessId: business, inquiryId, title: "Roof" });
    if (!job.ok) throw new Error(job.error);
    const mayaInvoice = recordInvoice({ businessId: business, customerId: maya, jobId: job.id, externalRef: "A", amountLabel: "sample", sourceSystem: "sample-ledger" });
    const samInvoice = recordInvoice({ businessId: business, customerId: sam, jobId: null, externalRef: "B", amountLabel: "sample", sourceSystem: "sample-ledger" });
    if (!mayaInvoice.ok || !samInvoice.ok) throw new Error("invoice");
    const otherCustomer = createCustomer({ businessId: other, name: "Pat", email: "pat@example.com" });
    const foreign = recordInvoice({ businessId: other, customerId: otherCustomer, externalRef: "C", amountLabel: "sample", sourceSystem: "sample-ledger" });
    if (!foreign.ok) throw new Error("foreign");
    const code = startVerification({ businessId: business, customerId: sam });
    if (!code.ok) throw new Error(code.error);
    const session = finishVerification({ businessId: business, customerId: sam, code: code.code });
    if (!session.ok) throw new Error(session.error);
    expect(lookupAuthorizedInvoice(session.token, samInvoice.id).ok).toBe(true);
    expect(lookupAuthorizedInvoice(session.token, mayaInvoice.id).ok).toBe(false);
    expect(lookupAuthorizedInvoice(session.token, foreign.id).ok).toBe(false);
    expect(lookupAuthorizedInvoice("not-a-session", samInvoice.id).ok).toBe(false);
  });

  it("stores a photo on the inquiry and records a failed send", () => {
    const { business, inquiryId } = world();
    const job = createJob({ businessId: business, inquiryId, title: "Roof" });
    if (!job.ok) throw new Error(job.error);
    const file = attachMedia({ businessId: business, inquiryId, jobId: job.id, filename: "../roof.jpg", mediaType: "image/jpeg", bytes: Buffer.from("jpeg"), permission: "job_documentation" });
    expect(file.ok).toBe(true);
    if (file.ok) {
      expect(file.path.includes("..")).toBe(false);
      expect(fs.existsSync(path.join(process.env.OPS_FILES_DIR!, file.path))).toBe(true);
    }
    const otherFile = attachMedia({ businessId: business, inquiryId: "inq_other", filename: "x.jpg", mediaType: "image/jpeg", bytes: Buffer.from("x"), permission: "job_documentation" });
    expect(otherFile.ok).toBe(false);
    const failed = sendCustomerMessage({ businessId: business, inquiryId, channel: "sms", body: "Confirmed", idempotencyKey: "sms-1", fail: true });
    const replay = sendCustomerMessage({ businessId: business, inquiryId, channel: "sms", body: "Confirmed", idempotencyKey: "sms-1", fail: true });
    expect(failed.ok && failed.delivery).toBe("failed");
    expect(replay.ok && replay.duplicate).toBe(true);
    const blocked = sendCustomerMessage({ businessId: business, inquiryId, channel: "whatsapp", body: "Hello" });
    expect(blocked.ok && blocked.delivery).toBe("failed");
  });

  it("requires approval before publication and a real payment before a review", () => {
    const { business, maya, inquiryId } = world();
    const job = createJob({ businessId: business, inquiryId, title: "Roof" });
    if (!job.ok) throw new Error(job.error);
    updateJob({ businessId: business, jobId: job.id, stage: "complete", notes: "Section replaced." });
    expect(requestReview({ businessId: business, jobId: job.id, customerId: maya }).ok).toBe(false);
    const invoice = recordInvoice({ businessId: business, customerId: maya, jobId: job.id, externalRef: "A", amountLabel: "sample", sourceSystem: "sample-ledger" });
    if (!invoice.ok) throw new Error("invoice");
    expect(confirmPayment({ businessId: business, invoiceId: invoice.id, source: "note", amountLabel: "sample", idempotencyKey: "pay-0" }).ok).toBe(false);
    const payment = confirmPayment({ businessId: business, invoiceId: invoice.id, source: "provider_event", amountLabel: "sample", idempotencyKey: "pay-1" });
    const paymentReplay = confirmPayment({ businessId: business, invoiceId: invoice.id, source: "provider_event", amountLabel: "sample", idempotencyKey: "pay-1" });
    expect(payment.ok && paymentReplay.ok && paymentReplay.duplicate).toBe(true);
    updateJob({ businessId: business, jobId: job.id, stage: "paid" });
    expect(requestReview({ businessId: business, jobId: job.id, customerId: maya }).ok).toBe(true);
    const drafts = generateContentOptions({ businessId: business, jobId: job.id });
    if (!drafts.ok) throw new Error(drafts.error);
    expect(drafts.concepts).toHaveLength(3);
    expect(publishContent({ businessId: business, contentId: drafts.ids[0] }).ok).toBe(false);
    expect(approveContent({ businessId: business, contentId: drafts.ids[0] }).ok).toBe(true);
    const published = publishContent({ businessId: business, contentId: drafts.ids[0] });
    expect(published.ok && published.status).toBe("blocked");
  });

  it("seeds the fictional examples twice and keeps Sam off Maya's job", () => {
    ensureShowcase();
    ensureShowcase();
    const sam = get<{ customer_id: string; job_id: string | null }>("SELECT customer_id, job_id FROM ops_invoices WHERE id = ?", SHOWCASE.samInvoice);
    const maya = get<{ customer_id: string; job_id: string | null }>("SELECT customer_id, job_id FROM ops_invoices WHERE id = ?", SHOWCASE.mayaInvoice);
    const content = get<{ status: string }>("SELECT status FROM ops_content WHERE id = ?", SHOWCASE.content);
    expect(sam).toEqual({ customer_id: SHOWCASE.sam, job_id: null });
    expect(maya?.customer_id).toBe(SHOWCASE.maya);
    expect(maya?.job_id).toBe(SHOWCASE.job);
    expect(content?.status).toBe("approved");
  });
});
