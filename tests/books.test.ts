import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, get, resetDbForTests, run } from "../lib/db";
import { id } from "../lib/ids";
import { completeDemoService } from "../lib/invoice";
import { booksBalance, journalLines, postInvoice, postJournal, postPayment } from "../lib/ledger";
import { ensureSeed } from "../lib/seed";
import { reviewCustomer, reviewInquiry, reviewJournal, setAskForTests, syncCustomer } from "../lib/scoring";
import { runScenario } from "../lib/replay";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "palmetto-books-"));
  process.env.DATABASE_PATH = path.join(dir, "t.sqlite");
  process.env.SCHEDULER_DISABLED = "1";
  delete process.env.AGENTMAIL_API_KEY;
  resetDbForTests(process.env.DATABASE_PATH);
  ensureSeed();
  setAskForTests(null);
});

afterEach(() => {
  setAskForTests(null);
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("ledger", () => {
  it("posts a balanced invoice once and rejects an unbalanced journal", async () => {
    const inquiryId = await runScenario("en");
    const done = await completeDemoService({ inquiryId, ownerName: "Alex Rivera", delivery: "simulated", sourceKind: "simulated" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const first = postInvoice(done.invoiceId);
    const again = postInvoice(done.invoiceId);
    expect(again.created).toBe(false);
    expect(again.journalId).toBe(first.journalId);
    const books = booksBalance();
    expect(books.balanced).toBe(true);
    expect(books.debit).toBe(books.credit);
    const invoice = get<{ total_cents: number }>("SELECT total_cents FROM invoices WHERE id = ?", done.invoiceId);
    const receivable = get<{ debit: number }>(
      "SELECT debit_cents AS debit FROM journal_lines WHERE journal_id = ? AND account_code = '1200'",
      first.journalId,
    );
    expect(receivable?.debit).toBe(invoice?.total_cents);
    expect(() =>
      postJournal({
        sourceType: "manual",
        sourceId: "bad",
        memo: "bad",
        postedBy: "test",
        lines: [{ account: "1000", debitCents: 100, creditCents: 0, memo: "cash" }],
      }),
    ).toThrow(/Unbalanced/);
    expect(get("SELECT id FROM journals WHERE source_id = 'bad'")).toBeUndefined();
  });

  it("collects cash without exceeding the open receivable", async () => {
    const inquiryId = await runScenario("en");
    const done = await completeDemoService({ inquiryId, ownerName: "Alex Rivera", delivery: "simulated", sourceKind: "simulated" });
    if (!done.ok) throw new Error(done.error);
    const invoice = get<{ total_cents: number }>("SELECT total_cents FROM invoices WHERE id = ?", done.invoiceId)!;
    const paid = postPayment({ invoiceId: done.invoiceId, amountCents: invoice.total_cents, postedBy: "Alex Rivera", idempotencyKey: "pay-1" });
    const retry = postPayment({ invoiceId: done.invoiceId, amountCents: invoice.total_cents, postedBy: "Alex Rivera", idempotencyKey: "pay-1" });
    expect(retry.created).toBe(false);
    expect(retry.journalId).toBe(paid.journalId);
    expect(booksBalance().balanced).toBe(true);
    expect(() => postPayment({ invoiceId: done.invoiceId, amountCents: 1, postedBy: "Alex Rivera", idempotencyKey: "pay-2" })).toThrow(/exceeds/);
  });
});

describe("crm and jev", () => {
  it("flags a duplicate and does not merge", () => {
    const stamp = new Date().toISOString();
    const first = id("cus");
    const second = id("cus");
    run("INSERT INTO customers(id, name, phone, email, preferred_language, created_at) VALUES(?, 'A', '+17725550111', 'a@example.com', 'en', ?)", first, stamp);
    run("INSERT INTO customers(id, name, phone, email, preferred_language, created_at) VALUES(?, 'B', '+1 (772) 555-0111', 'other@example.com', 'en', ?)", second, stamp);
    syncCustomer(second);
    const flags = get<{ n: number }>("SELECT COUNT(*) AS n FROM flags WHERE subject_id = ? AND kind = 'duplicate'", second);
    const customers = get<{ n: number }>("SELECT COUNT(*) AS n FROM customers WHERE id IN (?, ?)", first, second);
    expect(flags?.n).toBe(1);
    expect(customers?.n).toBe(2);
  });

  it("lets Jev flag a posting without rewriting it", async () => {
    const inquiryId = await runScenario("en");
    const done = await completeDemoService({ inquiryId, ownerName: "Alex Rivera", delivery: "simulated", sourceKind: "simulated" });
    if (!done.ok) throw new Error(done.error);
    const journalId = get<{ id: string }>("SELECT id FROM journals WHERE source_id = ?", done.invoiceId)!.id;
    const before = journalLines(journalId);
    setAskForTests(async () => ({
      model: "jev-test",
      answers: { categorization: { type: "choice", choice: "wrong", confidence: 0.91, probabilities: { wrong: 0.91, fits: 0.09, suspense: 0 } } },
    }));
    await reviewJournal(journalId);
    expect(journalLines(journalId)).toEqual(before);
    const flag = get<{ detail: string }>("SELECT detail FROM flags WHERE subject_id = ? AND kind = 'miscategorized'", journalId);
    expect(flag?.detail).toContain("wrong");
    const review = get<{ degraded: number; model: string }>("SELECT degraded, model FROM reviews WHERE subject_id = ? AND question = 'categorization' ORDER BY created_at DESC LIMIT 1", journalId);
    expect(review?.degraded).toBe(0);
    expect(review?.model).toBe("jev-test");
  });

  it("marks a rules review degraded when Jev is not called", async () => {
    const inquiryId = await runScenario("es");
    run("UPDATE inquiries SET issue = ? WHERE id = ?", "There is a burst pipe and no water", inquiryId);
    await reviewInquiry(inquiryId);
    const review = get<{ degraded: number; model: string }>("SELECT degraded, model FROM reviews WHERE subject_id = ?", inquiryId);
    const flag = get("SELECT id FROM flags WHERE subject_id = ? AND kind = 'urgent'", inquiryId);
    expect(review?.degraded).toBe(1);
    expect(review?.model).toBe("rules");
    expect(flag).toBeTruthy();
    await reviewCustomer(get<{ customer_id: string }>("SELECT customer_id FROM inquiries WHERE id = ?", inquiryId)!.customer_id);
  });
});
