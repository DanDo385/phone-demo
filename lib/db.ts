import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  email TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  status TEXT NOT NULL,
  preferred_language TEXT NOT NULL,
  language_lock TEXT,
  language_asked INTEGER NOT NULL DEFAULT 0,
  issue TEXT,
  service_code TEXT,
  service_address TEXT,
  in_service_area INTEGER,
  facts_json TEXT NOT NULL,
  followup_requested INTEGER NOT NULL DEFAULT 0,
  followup_note TEXT,
  calendar_revealed INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL,
  recording_enabled INTEGER NOT NULL DEFAULT 0,
  voice_id TEXT,
  replay_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_conversation_id TEXT,
  call_sid TEXT,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE TABLE IF NOT EXISTS transcript_turns (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT NOT NULL,
  started_at TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  ordinal INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL,
  language TEXT NOT NULL,
  text TEXT,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS language_events (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  session_id TEXT,
  from_language TEXT,
  to_language TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_kind TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  session_id TEXT,
  name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  args_redacted_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  status TEXT NOT NULL,
  idempotency_key TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  source_kind TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tool_idem ON tool_executions(inquiry_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  source_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data_json TEXT
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  technician_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  address TEXT NOT NULL,
  language TEXT NOT NULL,
  issue TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  source_kind TEXT NOT NULL,
  google_event_id TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS appt_slot ON appointments(technician_id, starts_at) WHERE status = 'booked';
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  provider_thread_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  idempotency_key TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS email_idem ON emails(inquiry_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_kind TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL UNIQUE,
  number TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  tax_note TEXT NOT NULL,
  demo_banner TEXT NOT NULL,
  status TEXT NOT NULL,
  pdf_path TEXT,
  created_at TEXT NOT NULL,
  approved_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  code TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_es TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS review_invitations (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  email_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_events (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  inquiry_id TEXT NOT NULL,
  type TEXT NOT NULL,
  destination TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_submissions (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  rating INTEGER,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT,
  kind TEXT NOT NULL,
  run_at TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS access_tokens (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_receipts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE(provider, event_id)
);
CREATE TABLE IF NOT EXISTS owner_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS owner_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_refs (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS calls (
  call_sid TEXT PRIMARY KEY,
  inquiry_id TEXT,
  from_number TEXT,
  to_number TEXT,
  status TEXT NOT NULL,
  forwarded INTEGER NOT NULL DEFAULT 0,
  dial_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_profiles (
  customer_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'lead',
  address TEXT,
  source TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_notes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  normal TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  invoice_id TEXT,
  memo TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  posted_by TEXT NOT NULL,
  UNIQUE(source_type, source_id)
);
CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL,
  account_code TEXT NOT NULL,
  debit_cents INTEGER NOT NULL,
  credit_cents INTEGER NOT NULL,
  memo TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  degraded INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS flags (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  review_id TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS flags_open ON flags(subject_type, subject_id, kind) WHERE resolved_at IS NULL;
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  stage TEXT,
  website TEXT NOT NULL,
  gbp_input TEXT,
  email TEXT NOT NULL,
  phone_e164 TEXT,
  client_ip TEXT,
  sources_json TEXT,
  analysis_json TEXT,
  error TEXT,
  report_email_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS prospects_phone ON prospects(phone_e164, created_at);
CREATE TABLE IF NOT EXISTS prospect_calls (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  conversation_id TEXT UNIQUE,
  call_sid TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  email_status TEXT,
  started_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE INDEX IF NOT EXISTS prospect_calls_prospect ON prospect_calls(prospect_id, started_at);
CREATE TABLE IF NOT EXISTS prospect_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  at_secs REAL,
  created_at TEXT NOT NULL,
  UNIQUE(call_id, seq)
);
CREATE TABLE IF NOT EXISTS prospect_bookings (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  call_id TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  service TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS relay_turns (
  tool_use_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

type Sql = DatabaseSync;

let singleton: Sql | null = null;
let singletonPath: string | null = null;

export function databasePath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  return path.join(process.cwd(), "data", "palmetto.sqlite");
}

// CREATE TABLE IF NOT EXISTS leaves existing tables alone; add columns introduced later.
function addMissingColumns(db: Sql): void {
  const cols = (db.prepare("PRAGMA table_info(prospect_lines)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!cols.includes("at_secs")) db.exec("ALTER TABLE prospect_lines ADD COLUMN at_secs REAL");
}

export function getDb(): Sql {
  const target = databasePath();
  if (singleton && singletonPath === target) return singleton;
  if (singleton) {
    singleton.close();
    singleton = null;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const db = new DatabaseSync(target);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  addMissingColumns(db);
  singleton = db;
  singletonPath = target;
  return db;
}

export function resetDbForTests(target?: string): Sql {
  if (singleton) {
    singleton.close();
    singleton = null;
    singletonPath = null;
  }
  if (target) process.env.DATABASE_PATH = target;
  return getDb();
}

export function closeDb(): void {
  if (singleton) singleton.close();
  singleton = null;
  singletonPath = null;
}

export type Row = Record<string, unknown>;

export function all<T extends Row = Row>(sql: string, ...params: Array<string | number | null | Uint8Array>): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function get<T extends Row = Row>(sql: string, ...params: Array<string | number | null | Uint8Array>): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: Array<string | number | null | Uint8Array>): void {
  getDb().prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}
