import { get, run } from "@/lib/db";
import { boot, json } from "@/lib/http";
import { id } from "@/lib/ids";
import { cancelReminder } from "@/lib/reminders";
import { inquiryById, lookupToken, nowIso } from "@/lib/records";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  boot();
  const { token } = await context.params;
  const access = lookupToken(token, "review");
  if (!access) return json({ error: "expired" }, 401);
  const inquiry = inquiryById(access.inquiry_id);
  const platform = new URL(request.url).searchParams.get("platform") || "local";
  const invitation = get<{ id: string }>("SELECT id FROM review_invitations WHERE inquiry_id = ?", access.inquiry_id);
  if (invitation) {
    run(
      "INSERT INTO review_events(id, invitation_id, inquiry_id, type, destination, created_at) VALUES(?, ?, ?, 'click', ?, ?)",
      id("rve"),
      invitation.id,
      access.inquiry_id,
      platform,
      nowIso(),
    );
  }
  return json({ language: inquiry?.preferred_language || "en", platform });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  boot();
  const { token } = await context.params;
  const access = lookupToken(token, "review");
  if (!access) return json({ error: "expired" }, 401);
  const body = await request.json();
  if (body.optOut) {
    cancelReminder(access.inquiry_id, "opt_out");
    return json({ ok: true });
  }
  if (body.alreadyReviewed) {
    cancelReminder(access.inquiry_id, "already_reviewed");
    return json({ ok: true });
  }
  const text = String(body.body || "").trim();
  if (text.length < 2) return json({ error: "Write the review yourself" }, 400);
  run(
    "INSERT INTO review_submissions(id, inquiry_id, platform, body, created_at) VALUES(?, ?, ?, ?, ?)",
    id("sub"),
    access.inquiry_id,
    String(body.platform || "local"),
    text,
    nowIso(),
  );
  const invitation = get<{ id: string }>("SELECT id FROM review_invitations WHERE inquiry_id = ?", access.inquiry_id);
  if (invitation) {
    run(
      "INSERT INTO review_events(id, invitation_id, inquiry_id, type, destination, created_at) VALUES(?, ?, ?, 'submit', ?, ?)",
      id("rve"),
      invitation.id,
      access.inquiry_id,
      String(body.platform || "local"),
      nowIso(),
    );
  }
  return json({ ok: true, published: false });
}
