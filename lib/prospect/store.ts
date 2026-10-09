import { all, get, run, transaction } from "../db";
import { id } from "../ids";
import { nowIso } from "../records";
import type { Analysis } from "./schema";
import type { PlaceProfile, SiteScrape } from "./sources";

// "intake" rows come from the founding form and are never analyzed.
// "matched" is waiting on the confirm step and is not a pipeline stage.
export type ProspectStatus = "analyzing" | "ready" | "failed" | "intake" | "matched";

export type ProspectRow = {
  id: string;
  status: ProspectStatus;
  stage: string | null;
  website: string;
  gbp_input: string | null;
  email: string;
  phone_e164: string | null;
  client_ip: string | null;
  sources_json: string | null;
  analysis_json: string | null;
  error: string | null;
  report_email_status: string | null;
  place_id: string | null;
  place_confirmed: number;
  trade: string | null;
  service_area: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type CallRow = {
  id: string;
  prospect_id: string;
  conversation_id: string | null;
  call_sid: string | null;
  channel: "phone" | "browser";
  status: "live" | "ended" | "summarized";
  summary: string | null;
  email_status: string | null;
  started_at: string;
  last_activity_at: string;
  ended_at: string | null;
};

export type LineRow = { id: number; call_id: string; seq: number; speaker: "agent" | "caller"; text: string; at_secs: number | null; created_at: string };
export type Line = { speaker: "agent" | "caller"; text: string; atSecs?: number };

export function createProspect(input: {
  website: string;
  gbpInput: string;
  email: string;
  phone: string;
  ip: string;
  placeId: string;
  trade: string;
  serviceArea: string;
  idempotencyKey: string;
}): string {
  const existing = get<{ id: string }>("SELECT id FROM prospects WHERE idempotency_key = ?", input.idempotencyKey);
  if (existing) return existing.id;
  const pid = id("pro");
  const at = nowIso();
  run(
    `INSERT INTO prospects(id, status, stage, website, gbp_input, email, phone_e164, client_ip, place_id, place_confirmed, trade, service_area, source, idempotency_key, created_at, updated_at)
     VALUES(?, 'analyzing', 'queued', ?, ?, ?, ?, ?, ?, 1, ?, ?, 'try', ?, ?, ?)`,
    pid,
    input.website,
    input.gbpInput || null,
    input.email,
    input.phone || null,
    input.ip,
    input.placeId,
    input.trade || null,
    input.serviceArea || null,
    input.idempotencyKey,
    at,
    at,
  );
  return pid;
}

export function prospectByIdempotency(key: string): ProspectRow | undefined {
  return get<ProspectRow>("SELECT * FROM prospects WHERE idempotency_key = ?", key);
}

// A confirmed place can be replaced. Analysis restarts only after the new confirm.
export function confirmProspectPlace(pid: string, input: { placeId: string; website: string; gbpInput: string; trade: string; serviceArea: string }): void {
  const at = nowIso();
  run(
    `UPDATE prospects
     SET place_id = ?, place_confirmed = 1, status = 'analyzing', stage = 'queued',
         website = ?, gbp_input = ?, trade = ?, service_area = ?,
         analysis_json = NULL, sources_json = NULL, error = NULL, updated_at = ?
     WHERE id = ? AND source = 'try'`,
    input.placeId,
    input.website,
    input.gbpInput || null,
    input.trade || null,
    input.serviceArea || null,
    at,
    pid,
  );
}

export function reopenProspectConfirm(pid: string): boolean {
  const row = prospectById(pid);
  if (!row || row.source !== "try") return false;
  run("UPDATE prospects SET place_confirmed = 0, status = 'matched', stage = 'confirm', updated_at = ? WHERE id = ?", nowIso(), pid);
  return true;
}

export function prospectById(pid: string): ProspectRow | undefined {
  return get<ProspectRow>("SELECT * FROM prospects WHERE id = ?", pid);
}

export function setStage(pid: string, stage: string): void {
  run("UPDATE prospects SET stage = ?, updated_at = ? WHERE id = ?", stage, nowIso(), pid);
}

// Places content other than the place id is not stored. See docs/places-terms.md.
export function saveSources(pid: string, site: SiteScrape, place: PlaceProfile): void {
  const stored = {
    site,
    place: { found: place.found, query: place.query, placeId: place.placeId, error: place.error },
  };
  run("UPDATE prospects SET sources_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(stored), nowIso(), pid);
}

export function saveAnalysis(pid: string, analysis: Analysis): void {
  run("UPDATE prospects SET status = 'ready', stage = 'ready', analysis_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(analysis), nowIso(), pid);
}

export function failProspect(pid: string, error: string): void {
  run("UPDATE prospects SET status = 'failed', stage = 'failed', error = ?, updated_at = ? WHERE id = ?", error, nowIso(), pid);
}

export function setReportEmailStatus(pid: string, status: string): void {
  run("UPDATE prospects SET report_email_status = ?, updated_at = ? WHERE id = ?", status, nowIso(), pid);
}

export function analysisOf(row: ProspectRow | undefined): Analysis | null {
  return row?.analysis_json ? (JSON.parse(row.analysis_json) as Analysis) : null;
}

export function sourcesOf(row: ProspectRow | undefined): { site: SiteScrape; place: PlaceProfile } | null {
  return row?.sources_json ? JSON.parse(row.sources_json) : null;
}

export function recentAnalysesFromIp(ip: string, sinceIso: string, exceptId?: string): number {
  if (exceptId) {
    return get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects WHERE source = 'try' AND client_ip = ? AND created_at >= ? AND id != ?", ip, sinceIso, exceptId)?.n ?? 0;
  }
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects WHERE source = 'try' AND client_ip = ? AND created_at >= ?", ip, sinceIso)?.n ?? 0;
}

export function recentProspectsForPlace(placeId: string, sinceIso: string, exceptId?: string): number {
  if (exceptId) {
    return get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects WHERE source = 'try' AND place_id = ? AND created_at >= ? AND id != ?", placeId, sinceIso, exceptId)?.n ?? 0;
  }
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM prospects WHERE source = 'try' AND place_id = ? AND created_at >= ?", placeId, sinceIso)?.n ?? 0;
}

export function recordPlaceLookup(ip: string, placeId: string | null, kind: "lookup" | "autocomplete"): void {
  run("INSERT INTO place_lookups(client_ip, place_id, kind, created_at) VALUES (?, ?, ?, ?)", ip, placeId, kind, nowIso());
}

export function recentPlaceLookups(filter: { ip?: string; placeId?: string; kind: "lookup" | "autocomplete" }, sinceIso: string): number {
  if (filter.placeId) {
    return get<{ n: number }>("SELECT COUNT(*) AS n FROM place_lookups WHERE kind = ? AND place_id = ? AND created_at >= ?", filter.kind, filter.placeId, sinceIso)?.n ?? 0;
  }
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM place_lookups WHERE kind = ? AND client_ip = ? AND created_at >= ?", filter.kind, filter.ip || "", sinceIso)?.n ?? 0;
}

// Caller ID first; otherwise the most recent ready prospect from the last 15 minutes.
export function prospectForCaller(fromE164: string): ProspectRow | undefined {
  const day = new Date(Date.now() - 24 * 3600_000).toISOString();
  const matched = fromE164
    ? get<ProspectRow>(
        "SELECT * FROM prospects WHERE phone_e164 = ? AND status = 'ready' AND created_at >= ? ORDER BY created_at DESC LIMIT 1",
        fromE164,
        day,
      )
    : undefined;
  if (matched) return matched;
  const recent = new Date(Date.now() - 15 * 60_000).toISOString();
  return get<ProspectRow>("SELECT * FROM prospects WHERE status = 'ready' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 1", recent);
}

export function openCall(input: { prospectId: string; channel: "phone" | "browser"; conversationId?: string; callSid?: string }): string {
  const cid = id("pcall");
  const at = nowIso();
  run(
    `INSERT INTO prospect_calls(id, prospect_id, conversation_id, call_sid, channel, status, started_at, last_activity_at)
     VALUES(?, ?, ?, ?, ?, 'live', ?, ?)`,
    cid,
    input.prospectId,
    input.conversationId ?? null,
    input.callSid ?? null,
    input.channel,
    at,
    at,
  );
  return cid;
}

// The relay sees the ElevenLabs conversation id on every turn; bind it to the newest
// unbound live call for that prospect, or open one (a browser call opened elsewhere, or
// a phone call whose register step we did not see).
export function callForConversation(prospectId: string, conversationId: string): CallRow {
  const existing = get<CallRow>("SELECT * FROM prospect_calls WHERE conversation_id = ?", conversationId);
  if (existing) return existing;
  const unbound = get<CallRow>(
    "SELECT * FROM prospect_calls WHERE prospect_id = ? AND conversation_id IS NULL AND status = 'live' ORDER BY started_at DESC LIMIT 1",
    prospectId,
  );
  if (unbound) {
    run("UPDATE prospect_calls SET conversation_id = ? WHERE id = ?", conversationId, unbound.id);
    return { ...unbound, conversation_id: conversationId };
  }
  const cid = openCall({ prospectId, channel: "phone", conversationId });
  return get<CallRow>("SELECT * FROM prospect_calls WHERE id = ?", cid)!;
}

export function callById(cid: string): CallRow | undefined {
  return get<CallRow>("SELECT * FROM prospect_calls WHERE id = ?", cid);
}

export function callsFor(pid: string): CallRow[] {
  return all<CallRow>("SELECT * FROM prospect_calls WHERE prospect_id = ? ORDER BY started_at DESC", pid);
}

export function linesFor(cid: string): LineRow[] {
  return all<LineRow>("SELECT * FROM prospect_lines WHERE call_id = ? ORDER BY seq", cid);
}

// The transcript is rewritten whole from the latest authoritative history. ElevenLabs sends
// speculative turns and discards some, so appending by count drifts; replacing never does.
export function replaceLines(cid: string, lines: Line[]): void {
  const at = nowIso();
  transaction(() => {
    const existing = all<{ seq: number; speaker: string; text: string; created_at: string }>(
      "SELECT seq, speaker, text, created_at FROM prospect_lines WHERE call_id = ? ORDER BY seq",
      cid,
    );
    run("DELETE FROM prospect_lines WHERE call_id = ?", cid);
    lines.forEach((line, seq) => {
      const same = existing[seq] && existing[seq].speaker === line.speaker && existing[seq].text === line.text;
      run(
        "INSERT INTO prospect_lines(call_id, seq, speaker, text, at_secs, created_at) VALUES(?, ?, ?, ?, ?, ?)",
        cid,
        seq,
        line.speaker,
        line.text,
        line.atSecs ?? null,
        same ? existing[seq].created_at : at,
      );
    });
    run("UPDATE prospect_calls SET last_activity_at = ? WHERE id = ?", at, cid);
  });
}

export function markCallEnded(cid: string): boolean {
  const at = nowIso();
  const call = callById(cid);
  if (!call || call.status !== "live") return false;
  run("UPDATE prospect_calls SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'live'", at, cid);
  return true;
}

export function saveCallSummary(cid: string, summary: string, emailStatus: string): void {
  run("UPDATE prospect_calls SET status = 'summarized', summary = ?, email_status = ? WHERE id = ?", summary, emailStatus, cid);
}

// Live calls with no activity for this long are treated as over (dropped browser tab, missed callback).
export function staleLiveCalls(idleMs: number): CallRow[] {
  const cutoff = new Date(Date.now() - idleMs).toISOString();
  return all<CallRow>("SELECT * FROM prospect_calls WHERE status = 'live' AND last_activity_at < ?", cutoff);
}

export type BookingRow = {
  id: string;
  prospect_id: string;
  call_id: string | null;
  starts_at: string;
  ends_at: string;
  service: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_at: string;
};

export function bookingsFor(pid: string): BookingRow[] {
  return all<BookingRow>("SELECT * FROM prospect_bookings WHERE prospect_id = ? ORDER BY starts_at", pid);
}

export function addBooking(input: Omit<BookingRow, "id" | "created_at">): string {
  const bid = id("pbk");
  run(
    `INSERT INTO prospect_bookings(id, prospect_id, call_id, starts_at, ends_at, service, customer_name, customer_phone, notes, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bid,
    input.prospect_id,
    input.call_id,
    input.starts_at,
    input.ends_at,
    input.service,
    input.customer_name,
    input.customer_phone,
    input.notes,
    nowIso(),
  );
  return bid;
}
