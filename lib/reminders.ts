import { reminderDraft } from "./copy";
import { all, get, run } from "./db";
import { appBaseUrl, id } from "./ids";
import { deliverEmail } from "./providers/agentmail";
import { addTimeline, demoNow, inquiryById, issueToken, nowIso } from "./records";

export async function tickReminders(): Promise<void> {
  const due = all<{ id: string; inquiry_id: string; payload_json: string; idempotency_key: string }>(
    "SELECT id, inquiry_id, payload_json, idempotency_key FROM scheduled_jobs WHERE kind = 'review_reminder' AND status = 'pending' AND run_at <= ? ORDER BY run_at ASC",
    demoNow().toISOString(),
  );
  for (const job of due) {
    run(
      "UPDATE scheduled_jobs SET status = 'running', locked_at = ?, attempts = attempts + 1 WHERE id = ? AND status = 'pending'",
      nowIso(),
      job.id,
    );
    const locked = get<{ status: string }>("SELECT status FROM scheduled_jobs WHERE id = ?", job.id);
    if (locked?.status !== "running") continue;
    try {
      const result = await sendReminder(job);
      if (result === "cancelled") continue;
      run("UPDATE scheduled_jobs SET status = 'done', finished_at = ? WHERE id = ?", nowIso(), job.id);
    } catch (error) {
      run(
        "UPDATE scheduled_jobs SET status = 'failed', last_error = ?, finished_at = ? WHERE id = ?",
        error instanceof Error ? error.message : "failed",
        nowIso(),
        job.id,
      );
    }
  }
}

async function sendReminder(job: { id: string; inquiry_id: string; payload_json: string; idempotency_key: string }): Promise<"sent" | "cancelled"> {
  const invitation = get<{ id: string; status: string; language: string }>(
    "SELECT id, status, language FROM review_invitations WHERE inquiry_id = ?",
    job.inquiry_id,
  );
  if (!invitation || invitation.status === "opted_out" || invitation.status === "completed_reported") {
    run("UPDATE scheduled_jobs SET status = 'cancelled', finished_at = ? WHERE id = ?", nowIso(), job.id);
    return "cancelled";
  }
  const existing = get("SELECT id FROM emails WHERE inquiry_id = ? AND idempotency_key = ?", job.inquiry_id, `reminder:${invitation.id}`);
  if (existing) return "sent";
  const inquiry = inquiryById(job.inquiry_id);
  if (!inquiry) return "cancelled";
  const facts = JSON.parse(inquiry.facts_json) as { email?: string };
  if (!facts.email) return "cancelled";
  const raw = issueToken(job.inquiry_id, "review", 14);
  const draft = reminderDraft({
    lang: invitation.language === "es" ? "es" : "en",
    link: `${appBaseUrl()}/review/${raw}`,
  });
  const mode = invitation.status === "sent" ? "connected" : "simulated";
  const sent = await deliverEmail({ to: facts.email, subject: draft.subject, text: draft.text, html: draft.html, mode });
  run(
    `INSERT INTO emails(id, inquiry_id, kind, to_address, subject, text_body, html_body, language, status, provider, provider_message_id, error, created_at, idempotency_key)
     VALUES(?, ?, 'reminder', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id("em"),
    job.inquiry_id,
    facts.email,
    draft.subject,
    draft.text,
    draft.html,
    draft.language,
    sent.status,
    sent.provider,
    sent.messageId ?? null,
    sent.error ?? null,
    nowIso(),
    `reminder:${invitation.id}`,
  );
  if (sent.status === "failed") throw new Error(sent.error || "Reminder was not sent");
  addTimeline({
    inquiryId: job.inquiry_id,
    kind: "reminder_sent",
    title: "Review reminder prepared",
    detail: sent.status === "simulated" ? "Simulated — demo clock, not a real 48-hour wait" : sent.status,
    sourceKind: sent.status === "simulated" ? "simulated" : "live",
  });
  return "sent";
}

export function cancelReminder(inquiryId: string, reason: "opt_out" | "already_reviewed" | "owner"): void {
  const invitation = get<{ id: string }>("SELECT id FROM review_invitations WHERE inquiry_id = ?", inquiryId);
  if (invitation) {
    run(
      "UPDATE review_invitations SET status = ? WHERE id = ?",
      reason === "already_reviewed" ? "completed_reported" : "opted_out",
      invitation.id,
    );
    run(
      "INSERT INTO review_events(id, invitation_id, inquiry_id, type, note, created_at) VALUES(?, ?, ?, ?, ?, ?)",
      id("rve"),
      invitation.id,
      inquiryId,
      reason === "already_reviewed" ? "already_reviewed" : "opt_out",
      reason,
      nowIso(),
    );
  }
  run(
    "UPDATE scheduled_jobs SET status = 'cancelled', finished_at = ? WHERE inquiry_id = ? AND kind = 'review_reminder' AND status IN ('pending', 'running')",
    nowIso(),
    inquiryId,
  );
  addTimeline({
    inquiryId,
    kind: "reminder_cancelled",
    title: "Review reminder cancelled",
    detail: reason,
    sourceKind: "simulated",
  });
}

export function advanceDemoClock(ms: number): number {
  const current = Number(get<{ value: string }>("SELECT value FROM settings WHERE key = ?", "demo_clock_offset_ms")?.value ?? 0);
  const next = current + ms;
  run(
    "INSERT INTO settings(key, value) VALUES('demo_clock_offset_ms', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    String(next),
  );
  return next;
}

export function advanceClockToReminder(inquiryId: string): { offset: number; runAt: string | null } {
  const job = get<{ run_at: string }>(
    "SELECT run_at FROM scheduled_jobs WHERE inquiry_id = ? AND kind = 'review_reminder' AND status = 'pending' ORDER BY run_at ASC LIMIT 1",
    inquiryId,
  );
  if (!job) {
    const current = Number(get<{ value: string }>("SELECT value FROM settings WHERE key = ?", "demo_clock_offset_ms")?.value ?? 0);
    return { offset: current, runAt: null };
  }
  const needed = new Date(job.run_at).getTime() - Date.now() + 2000;
  const current = Number(get<{ value: string }>("SELECT value FROM settings WHERE key = ?", "demo_clock_offset_ms")?.value ?? 0);
  const offset = Math.max(current, needed);
  run(
    "INSERT INTO settings(key, value) VALUES('demo_clock_offset_ms', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    String(offset),
  );
  return { offset, runAt: job.run_at };
}
