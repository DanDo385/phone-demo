import { SERVICES } from "./business";
import { all, get, run, transaction } from "./db";
import { id } from "./ids";

export const CHART = [
  { code: "1000", name: "Cash", kind: "asset", normal: "debit" },
  { code: "1200", name: "Accounts receivable", kind: "asset", normal: "debit" },
  { code: "4000", name: "Service revenue", kind: "revenue", normal: "credit" },
  { code: "4010", name: "Diagnostic revenue", kind: "revenue", normal: "credit" },
  { code: "4900", name: "Diagnostic credits", kind: "contra-revenue", normal: "debit" },
  { code: "4999", name: "Uncategorized revenue", kind: "revenue", normal: "credit" },
] as const;

const DIAGNOSTIC = new Set(["DIAG", "WATER_HEATER_DIAG", "HVAC_DIAG", "ELEC_DIAG", "DRAIN_ACCESS"]);

export type JournalLine = {
  account: string;
  debitCents: number;
  creditCents: number;
  memo: string;
};

export function ensureChart(): void {
  for (const account of CHART) {
    run(
      "INSERT INTO accounts(code, name, kind, normal) VALUES(?, ?, ?, ?) ON CONFLICT(code) DO NOTHING",
      account.code,
      account.name,
      account.kind,
      account.normal,
    );
  }
}

export function accountForCode(code: string): string {
  if (code === "DIAG_CREDIT") return "4900";
  if (DIAGNOSTIC.has(code)) return "4010";
  if (SERVICES.some((service) => service.code === code)) return "4000";
  return "4999";
}

export function linesForInvoice(lines: Array<{ code: string; amount_cents: number }>): JournalLine[] {
  const posted: JournalLine[] = [];
  let receivable = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.amount_cents) || line.amount_cents === 0) continue;
    const account = accountForCode(line.code);
    if (line.amount_cents > 0) {
      posted.push({ account, debitCents: 0, creditCents: line.amount_cents, memo: line.code });
    } else {
      posted.push({ account, debitCents: -line.amount_cents, creditCents: 0, memo: line.code });
    }
    receivable += line.amount_cents;
  }
  if (receivable > 0) posted.push({ account: "1200", debitCents: receivable, creditCents: 0, memo: "Accounts receivable" });
  if (receivable < 0) posted.push({ account: "1200", debitCents: 0, creditCents: -receivable, memo: "Accounts receivable" });
  return posted;
}

export function postJournal(input: {
  sourceType: string;
  sourceId: string;
  memo: string;
  postedBy: string;
  lines: JournalLine[];
  invoiceId?: string;
}): { journalId: string; created: boolean } {
  ensureChart();
  const existing = get<{ id: string }>(
    "SELECT id FROM journals WHERE source_type = ? AND source_id = ?",
    input.sourceType,
    input.sourceId,
  );
  if (existing) return { journalId: existing.id, created: false };
  assertBalanced(input.lines);
  const journalId = id("jrnl");
  const stamp = new Date().toISOString();
  transaction(() => {
    run(
      "INSERT INTO journals(id, source_type, source_id, invoice_id, memo, posted_at, posted_by) VALUES(?, ?, ?, ?, ?, ?, ?)",
      journalId,
      input.sourceType,
      input.sourceId,
      input.invoiceId ?? null,
      input.memo,
      stamp,
      input.postedBy,
    );
    input.lines.forEach((line, position) => {
      run(
        "INSERT INTO journal_lines(id, journal_id, account_code, debit_cents, credit_cents, memo, position) VALUES(?, ?, ?, ?, ?, ?, ?)",
        id("jln"),
        journalId,
        line.account,
        line.debitCents,
        line.creditCents,
        line.memo,
        position,
      );
    });
  });
  return { journalId, created: true };
}

export function postInvoice(invoiceId: string): { journalId: string; created: boolean } {
  const invoice = get<{ number: string; approved_by: string; total_cents: number }>(
    "SELECT number, approved_by, total_cents FROM invoices WHERE id = ?",
    invoiceId,
  );
  if (!invoice) throw new Error("Invoice not found");
  const lines = all<{ code: string; amount_cents: number }>(
    "SELECT code, amount_cents FROM invoice_lines WHERE invoice_id = ? ORDER BY position",
    invoiceId,
  );
  const posted = linesForInvoice(lines);
  const journal = postJournal({
    sourceType: "invoice",
    sourceId: invoiceId,
    invoiceId,
    memo: invoice.number,
    postedBy: invoice.approved_by,
    lines: posted,
  });
  const totals = journalTotals(journal.journalId);
  const receivable = receivableNet(journal.journalId);
  if (totals.debit !== totals.credit || receivable !== invoice.total_cents) {
    throw new Error("Posted journal does not match the invoice");
  }
  return journal;
}

export function postPayment(input: {
  invoiceId: string;
  amountCents: number;
  postedBy: string;
  idempotencyKey?: string;
}): { journalId: string; created: boolean } {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Payment must be a positive number of cents");
  const invoice = get<{ total_cents: number }>("SELECT total_cents FROM invoices WHERE id = ?", input.invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  postInvoice(input.invoiceId);
  const sourceId = input.idempotencyKey ?? `${input.invoiceId}:${paidOn(input.invoiceId)}:${input.amountCents}`;
  const existing = get<{ id: string }>("SELECT id FROM journals WHERE source_type = 'payment' AND source_id = ?", sourceId);
  if (existing) return { journalId: existing.id, created: false };
  const open = invoice.total_cents - paidOn(input.invoiceId);
  if (input.amountCents > open) throw new Error("Payment exceeds open receivable");
  return postJournal({
    sourceType: "payment",
    sourceId,
    invoiceId: input.invoiceId,
    memo: `Payment on ${input.invoiceId}`,
    postedBy: input.postedBy,
    lines: [
      { account: "1000", debitCents: input.amountCents, creditCents: 0, memo: "Cash" },
      { account: "1200", debitCents: 0, creditCents: input.amountCents, memo: "Accounts receivable" },
    ],
  });
}

export function trialBalance(): Array<{ code: string; name: string; kind: string; debit: number; credit: number }> {
  ensureChart();
  return all<{ code: string; name: string; kind: string; debit: number; credit: number }>(
    `SELECT a.code AS code, a.name AS name, a.kind AS kind,
            COALESCE(SUM(l.debit_cents), 0) AS debit,
            COALESCE(SUM(l.credit_cents), 0) AS credit
     FROM accounts a
     LEFT JOIN journal_lines l ON l.account_code = a.code
     GROUP BY a.code
     ORDER BY a.code`,
  ).map((row) => ({ ...row, debit: Number(row.debit), credit: Number(row.credit) }));
}

export function booksBalance(): { debit: number; credit: number; balanced: boolean } {
  const row = get<{ debit: number; credit: number }>(
    "SELECT COALESCE(SUM(debit_cents), 0) AS debit, COALESCE(SUM(credit_cents), 0) AS credit FROM journal_lines",
  );
  const debit = Number(row?.debit ?? 0);
  const credit = Number(row?.credit ?? 0);
  return { debit, credit, balanced: debit === credit };
}

export function recentJournals(limit = 20): Array<{ id: string; memo: string; source_type: string; posted_at: string; debit: number; invoice_id: string | null; inquiry_id: string | null }> {
  return all(
    `SELECT j.id AS id, j.memo AS memo, j.source_type AS source_type, j.posted_at AS posted_at,
            j.invoice_id AS invoice_id, i.inquiry_id AS inquiry_id,
            COALESCE(SUM(l.debit_cents), 0) AS debit
     FROM journals j
     LEFT JOIN journal_lines l ON l.journal_id = j.id
     LEFT JOIN invoices i ON i.id = j.invoice_id
     GROUP BY j.id ORDER BY j.posted_at DESC LIMIT ?`,
    limit,
  );
}

export function journalLines(journalId: string): Array<{ account_code: string; debit_cents: number; credit_cents: number; memo: string }> {
  return all(
    "SELECT account_code, debit_cents, credit_cents, memo FROM journal_lines WHERE journal_id = ? ORDER BY position",
    journalId,
  );
}

function journalTotals(journalId: string): { debit: number; credit: number } {
  const row = get<{ debit: number; credit: number }>(
    "SELECT COALESCE(SUM(debit_cents), 0) AS debit, COALESCE(SUM(credit_cents), 0) AS credit FROM journal_lines WHERE journal_id = ?",
    journalId,
  );
  return { debit: Number(row?.debit ?? 0), credit: Number(row?.credit ?? 0) };
}

function receivableNet(journalId: string): number {
  const row = get<{ debit: number; credit: number }>(
    "SELECT COALESCE(SUM(debit_cents), 0) AS debit, COALESCE(SUM(credit_cents), 0) AS credit FROM journal_lines WHERE journal_id = ? AND account_code = '1200'",
    journalId,
  );
  return Number(row?.debit ?? 0) - Number(row?.credit ?? 0);
}

function paidOn(invoiceId: string): number {
  const row = get<{ n: number }>(
    `SELECT COALESCE(SUM(l.credit_cents), 0) AS n
     FROM journals j JOIN journal_lines l ON l.journal_id = j.id
     WHERE j.source_type = 'payment' AND j.invoice_id = ? AND l.account_code = '1200'`,
    invoiceId,
  );
  return Number(row?.n ?? 0);
}

function assertBalanced(lines: JournalLine[]): void {
  if (!lines.length) throw new Error("Journal has no lines");
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (!CHART.some((account) => account.code === line.account)) throw new Error(`Unknown account ${line.account}`);
    if (!Number.isInteger(line.debitCents) || !Number.isInteger(line.creditCents)) throw new Error("Amounts must be integer cents");
    if (line.debitCents < 0 || line.creditCents < 0) throw new Error("Amounts cannot be negative");
    if (line.debitCents > 0 && line.creditCents > 0) throw new Error("A line cannot debit and credit");
    if (line.debitCents === 0 && line.creditCents === 0) throw new Error("A line cannot be zero");
    debit += line.debitCents;
    credit += line.creditCents;
  }
  if (debit !== credit) throw new Error(`Unbalanced journal: debit ${debit} credit ${credit}`);
}
