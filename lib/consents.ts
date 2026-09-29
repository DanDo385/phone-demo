import type { ConsentText } from "@/content/consent";
import { run } from "./db";
import { id } from "./ids";
import { nowIso } from "./records";

// Appends one consent row with the exact wording shown (CLAUDE.md). Rows are never updated;
// a withdrawal is another row with granted = false.
export function recordConsent(input: { prospectId: string; consent: ConsentText; granted: boolean; ip: string | null; userAgent: string | null; at?: string }): void {
  run(
    `INSERT INTO consents(id, prospect_id, channel, granted, text_shown, text_version, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id("cns"),
    input.prospectId,
    input.consent.channel,
    input.granted ? 1 : 0,
    input.consent.text,
    input.consent.version,
    input.ip,
    input.userAgent ? input.userAgent.slice(0, 400) : null,
    input.at ?? nowIso(),
  );
}
