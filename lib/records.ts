import { all, get, run, transaction } from "./db";
import { id, sha256, token } from "./ids";
import { redactJson } from "./redact";
import { syncCustomer } from "./scoring";
import type { DialogueState, Facts, Lang, SourceKind } from "./types";

export type InquiryRow = {
  id: string;
  customer_id: string | null;
  status: string;
  preferred_language: Lang;
  language_lock: string | null;
  language_asked: number;
  issue: string | null;
  service_code: string | null;
  service_address: string | null;
  in_service_area: number | null;
  facts_json: string;
  followup_requested: number;
  followup_note: string | null;
  calendar_revealed: number;
  origin: string;
  recording_enabled: number;
  voice_id: string | null;
  replay_json: string | null;
  created_at: string;
  updated_at: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function demoNow(): Date {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", "demo_clock_offset_ms");
  return new Date(Date.now() + Number(row?.value ?? 0));
}

export function setDemoOffset(ms: number): void {
  run(
    "INSERT INTO settings(key, value) VALUES('demo_clock_offset_ms', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    String(ms),
  );
}

export function getDemoOffset(): number {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", "demo_clock_offset_ms");
  return Number(row?.value ?? 0);
}

export function loadState(row: InquiryRow): DialogueState {
  const facts = JSON.parse(row.facts_json) as Facts;
  return {
    language: row.preferred_language,
    lock: (row.language_lock as DialogueState["lock"]) ?? null,
    languageAsked: Boolean(row.language_asked),
    facts,
  };
}

export function saveState(inquiryId: string, state: DialogueState): void {
  const facts = state.facts;
  run(
    `UPDATE inquiries SET preferred_language = ?, language_lock = ?, language_asked = ?, issue = ?, service_code = ?,
     service_address = ?, in_service_area = ?, facts_json = ?, followup_requested = ?, calendar_revealed = ?, updated_at = ?
     WHERE id = ?`,
    state.language,
    state.lock,
    state.languageAsked ? 1 : 0,
    facts.issue ?? null,
    facts.serviceCode ?? null,
    facts.address ?? null,
    facts.inServiceArea == null ? null : facts.inServiceArea ? 1 : 0,
    JSON.stringify(facts),
    facts.followupRequested ? 1 : 0,
    facts.schedulingStarted ? 1 : 0,
    nowIso(),
    inquiryId,
  );
  if (facts.email || facts.name || facts.phone) {
    const row = get<InquiryRow>("SELECT * FROM inquiries WHERE id = ?", inquiryId);
    if (!row?.customer_id) return;
    run(
      "UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email), preferred_language = ? WHERE id = ?",
      facts.name ?? null,
      facts.phone ?? null,
      facts.email ?? null,
      state.language,
      row.customer_id,
    );
    syncCustomer(row.customer_id);
  }
}

export function createInquiry(input: {
  origin: string;
  language: Lang;
  lock: DialogueState["lock"];
  channel: string;
  provider: string;
  sourceKind: SourceKind;
  voiceId?: string;
}): { inquiryId: string; sessionId: string; customerId: string } {
  const inquiryId = id("inq");
  const sessionId = id("ses");
  const customerId = id("cus");
  const stamp = nowIso();
  transaction(() => {
    run("INSERT INTO customers(id, preferred_language, created_at) VALUES(?, ?, ?)", customerId, input.language, stamp);
    run(
      `INSERT INTO inquiries(id, customer_id, status, preferred_language, language_lock, language_asked, facts_json, origin, recording_enabled, voice_id, created_at, updated_at)
       VALUES(?, ?, 'open', ?, ?, ?, '{}', ?, 0, ?, ?, ?)`,
      inquiryId,
      customerId,
      input.language,
      input.lock,
      input.lock === "explicit" ? 1 : 0,
      input.origin,
      input.voiceId ?? null,
      stamp,
      stamp,
    );
    run(
      `INSERT INTO sessions(id, inquiry_id, channel, provider, language, status, source_kind, started_at)
       VALUES(?, ?, ?, ?, ?, 'active', ?, ?)`,
      sessionId,
      inquiryId,
      input.channel,
      input.provider,
      input.language,
      input.sourceKind,
      stamp,
    );
  });
  return { inquiryId, sessionId, customerId };
}

export function activeSession(inquiryId: string): { id: string; source_kind: SourceKind; channel: string } | undefined {
  return get("SELECT id, source_kind, channel FROM sessions WHERE inquiry_id = ? ORDER BY started_at DESC LIMIT 1", inquiryId);
}

export function addTurn(input: {
  inquiryId: string;
  sessionId: string;
  speaker: "caller" | "agent" | "owner" | "system";
  text: string;
  language: Lang;
  sourceKind: SourceKind;
  translation?: { text: string; status: "generated" | "unavailable"; source: string };
}): string {
  const turnId = id("trn");
  const ordinal = get<{ n: number }>("SELECT COALESCE(MAX(ordinal), 0) AS n FROM transcript_turns WHERE inquiry_id = ?", input.inquiryId);
  run(
    `INSERT INTO transcript_turns(id, inquiry_id, session_id, speaker, text, language, started_at, source_kind, ordinal)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    turnId,
    input.inquiryId,
    input.sessionId,
    input.speaker,
    input.text,
    input.language,
    nowIso(),
    input.sourceKind,
    (ordinal?.n ?? 0) + 1,
  );
  if (input.translation) {
    run(
      "INSERT INTO translations(id, turn_id, language, text, status, source, created_at) VALUES(?, ?, 'en', ?, ?, ?, ?)",
      id("trl"),
      turnId,
      input.translation.text,
      input.translation.status,
      input.translation.source,
      nowIso(),
    );
  }
  return turnId;
}

export function addLanguageEvent(input: {
  inquiryId: string;
  sessionId?: string;
  from?: string;
  to: string;
  reason: string;
  sourceKind: SourceKind;
}): void {
  run(
    `INSERT INTO language_events(id, inquiry_id, session_id, from_language, to_language, reason, created_at, source_kind)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    id("lang"),
    input.inquiryId,
    input.sessionId ?? null,
    input.from ?? null,
    input.to,
    input.reason,
    nowIso(),
    input.sourceKind,
  );
}

export function addTimeline(input: {
  inquiryId: string;
  kind: string;
  title: string;
  detail?: string;
  sourceKind: SourceKind;
  data?: unknown;
}): void {
  run(
    `INSERT INTO timeline_events(id, inquiry_id, kind, title, detail, source_kind, created_at, data_json)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    id("evt"),
    input.inquiryId,
    input.kind,
    input.title,
    input.detail ?? null,
    input.sourceKind,
    nowIso(),
    input.data ? JSON.stringify(input.data) : null,
  );
}

export function startTool(input: {
  inquiryId: string;
  sessionId?: string;
  name: string;
  args: unknown;
  idempotencyKey?: string;
  sourceKind: SourceKind;
}): { id: string; duplicate?: { result_json: string | null; error: string | null; status: string } } {
  if (input.idempotencyKey) {
    const existing = get<{ id: string; result_json: string | null; error: string | null; status: string }>(
      "SELECT id, result_json, error, status FROM tool_executions WHERE inquiry_id = ? AND idempotency_key = ?",
      input.inquiryId,
      input.idempotencyKey,
    );
    if (existing) return { id: existing.id, duplicate: existing };
  }
  const toolId = id("tool");
  run(
    `INSERT INTO tool_executions(id, inquiry_id, session_id, name, args_json, args_redacted_json, status, idempotency_key, started_at, source_kind)
     VALUES(?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
    toolId,
    input.inquiryId,
    input.sessionId ?? null,
    input.name,
    JSON.stringify(input.args),
    redactJson(input.args),
    input.idempotencyKey ?? null,
    nowIso(),
    input.sourceKind,
  );
  return { id: toolId };
}

export function finishTool(toolId: string, input: { ok: boolean; result?: unknown; error?: string; startedAt: number }): void {
  run(
    "UPDATE tool_executions SET status = ?, result_json = ?, error = ?, finished_at = ?, duration_ms = ? WHERE id = ?",
    input.ok ? "succeeded" : "failed",
    input.result ? JSON.stringify(input.result) : null,
    input.error ?? null,
    nowIso(),
    Date.now() - input.startedAt,
    toolId,
  );
}

export function issueToken(inquiryId: string, purpose: "continuation" | "review", days = 7): string {
  const raw = token();
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  run(
    "INSERT INTO access_tokens(id, inquiry_id, token_hash, purpose, expires_at, created_at) VALUES(?, ?, ?, ?, ?, ?)",
    id("tok"),
    inquiryId,
    sha256(raw),
    purpose,
    expires,
    nowIso(),
  );
  return raw;
}

export function lookupToken(raw: string, purpose?: string): { inquiry_id: string; purpose: string; expires_at: string; revoked_at: string | null } | undefined {
  const row = get<{ inquiry_id: string; purpose: string; expires_at: string; revoked_at: string | null }>(
    "SELECT inquiry_id, purpose, expires_at, revoked_at FROM access_tokens WHERE token_hash = ?",
    sha256(raw),
  );
  if (!row) return undefined;
  if (purpose && row.purpose !== purpose) return undefined;
  if (row.revoked_at) return undefined;
  if (new Date(row.expires_at).getTime() < Date.now()) return undefined;
  return row;
}

export function rememberWebhook(provider: string, eventId: string): boolean {
  const existing = get("SELECT id FROM webhook_receipts WHERE provider = ? AND event_id = ?", provider, eventId);
  if (existing) return false;
  run("INSERT INTO webhook_receipts(id, provider, event_id, received_at) VALUES(?, ?, ?, ?)", id("wh"), provider, eventId, nowIso());
  return true;
}

export function listBusy(): Array<{ technicianId: string; start: string; end: string }> {
  return all<{ technician_id: string; starts_at: string; ends_at: string }>(
    "SELECT technician_id, starts_at, ends_at FROM appointments WHERE status = 'booked'",
  ).map((row) => ({ technicianId: row.technician_id, start: row.starts_at, end: row.ends_at }));
}

export function inquiryById(idValue: string): InquiryRow | undefined {
  return get<InquiryRow>("SELECT * FROM inquiries WHERE id = ?", idValue);
}

export function customerById(idValue: string): { id: string; name: string | null; phone: string | null; email: string | null; preferred_language: string } | undefined {
  return get("SELECT id, name, phone, email, preferred_language FROM customers WHERE id = ?", idValue);
}
