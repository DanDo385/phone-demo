# Docent Solutions: repo rules

## Who we sell to
Owners of HVAC and plumbing businesses with roughly 2-10 field employees around Port St. Lucie, FL. Owner-led sales, visible missed-call risk, weak or stale online presence. They read on phones, often in a truck.

## Voice
Practical, calm, operational. Never market "AI automation." Market fewer missed jobs, faster follow-up, cleaner operations, a better local presence.

## Offer (launch hypothesis; values live in lib/brand.ts, never hardcoded)
- Scribe: $297/month. Voice + SMS/MMS intake, booking and job records, draft invoices + payment links, review-request workflow, website + Google profile improvement workflow, portal and reports.
- Scribe + Squire: $497/month. Adds owned media library, post/blog/email drafts, short-form video, approval calendar, channel publishing adapters.
- Custom: quoted. Setup fee + higher retainer.
- Founding offer: first five qualified businesses get Scribe at $297, standard setup fee waived, Squire beta during the pilot, month-to-month.
- Ownership promise: "You own the number, domain, data, listing, calendar, and merchant account. Docent operates them with revocable access."

## Hard rules
- Label every demo and every piece of sample data. Palmetto Coast is fictional. A prospect's personalized demo is labeled as a demo built from public information, and anything we filled in is marked as filled in.
- No fabricated testimonials, logos, statistics, savings claims, or case studies. No "unlimited." No countdown timers; use "Founding access now open."
- No stock photos of people presented as a real client, a prospect's staff, or Docent's team. Stock imagery in previews is labeled as a sample image.
- The public site never asks for passwords, Google Workspace access, payment details, or domain credentials.
- The public site never publishes anything to a prospect's real website or Google profile.
- Every consent (email, SMS, call recording) stores the exact text shown and its version. SMS opt-in is a separate, unchecked checkbox.
- Every finding shown to a prospect cites an observed fact. LLMs phrase; they never supply facts.
- Every voice agent discloses in its first sentence that it is an AI assistant and that the call is recorded (Florida is all-party consent). Every voice agent handles emergency language (gas, smoke, CO alarm, sparking, flooding near electrical) by telling the caller to get safe and call 911 or the gas utility, and does not book.
- Brand names, prices, and offer terms come from lib/brand.ts only.
- Secrets come from the 1Password Environment, server-side only. Nothing secret gets a NEXT_PUBLIC_ prefix. Never log or print secrets.

## Engineering
- WCAG 2.2 AA, mobile-first. Marketing pages statically rendered.
- Any server fetch of a user-supplied URL goes through lib/safeFetch.ts (SSRF-protected).
- Paid third-party calls sit behind Turnstile + rate limits.
- Idempotency keys on every retryable write.

## Repo conventions

**Layout.** `app/(marketing)` is the public site and `app/(demo)` holds the demo surfaces: the fictional Palmetto Coast screens (`/demo`, `/call`, `/c`, `/review`, `/renew`, `/login`, `/dashboard`) and the prospect demo (`/try`). Each group has its own root layout and there is no `app/layout.tsx`. `app/api` sits outside both groups. When a URL moves, add it to `redirects.mjs`; `tests/routes.test.ts` fails if a redirect points at nothing or shadows a page. Palmetto copy lives in `lib/business.ts`, `lib/copy.ts`, and `agent/`. Public-site copy lives in `content/` (consent wording in `content/consent.ts`), separate from `components/marketing/`, and reads names and prices from `lib/brand.ts`; `tests/brand.test.ts` fails on a hardcoded brand name or price. `node scripts/check-marketing.mjs` checks every public route at 375px against a running server.

**Simulated vs live.** Every integration (ElevenLabs, Twilio, AgentMail, Google Calendar, Jev) runs live only when its credentials are present (`envPresent` in `lib/providers/status.ts`). Otherwise it runs simulated and says so in the UI. Rows carry `source_kind` (`live`, `post_call`, `simulated`, `simulated_replay`) so simulated data is never shown as real. A missing key means simulated mode, not an error.

**Never show a failed send as delivered.** Delivery results are `simulated`, `sent`, or `failed` with the reason (`lib/providers/agentmail.ts`). A failed Google insert leaves the appointment unconfirmed. The UI and emails report the stored status. Do not add an optimistic "sent" or "booked".

**Recipient guards.** Palmetto customer email goes through `deliverEmail`. It sends for real only when AgentMail is configured and the recipient equals `TEST_CUSTOMER_EMAIL`; any other address is `failed`, not sent. `sendAgentMail` is the raw send and does not choose recipients. Prospect mail (`lib/prospect/emails.ts`) goes only to the address the prospect typed, at most once per report and once per call. Recording stays off unless `RECORD_CALLS=true`.

**Consent and forms.** Consent wording is versioned from its own text (`content/consent.ts`); the server rejects a stale version and stores the exact text with `recordConsent`. Public forms that spend money or send mail check Turnstile (`lib/turnstile.ts`: skipped without a key outside production, refused in production), rate-limit per IP, and honor `DEMO_KILL_SWITCH`. Events go through `track()` (`lib/track.ts`) with no personal data in props.

**Retryable writes.** Tool calls, emails, scheduled jobs, and walkthrough bookings use a unique `idempotency_key`. Webhooks dedupe on `webhook_receipts(provider, event_id)`. A replayed write returns the first result.

**Database.** SQLite through `node:sqlite` (`lib/db.ts`). New tables go in `SCHEMA` as `CREATE TABLE IF NOT EXISTS`. New columns on existing tables go in both the `CREATE` and `addMissingColumns` (see `PROSPECT_COLUMNS`), so old databases upgrade in place. Migrations are additive only. `prospects.status` is the analysis pipeline; `prospects.lead_status` is the sales pipeline. `consents` is append-only and enforced by triggers.

**Secrets and 1Password.** Runtime values come from the `phone-demo-dev` Environment, mounted at `.env` (a FIFO; never copy `.env.example` over it). `.1password/project.toml [variables]` maps each variable to its canonical `op://` item and contains no secret values. For a new variable: add it to the canonical item, the manifest, `.env.example` (placeholder), and the Environment (by hand in the 1Password app, since scripts cannot update existing Environment variables). `tsx` scripts do not read `.env`; run them with `project-env npm run <script>`. Do not search the vault for credentials; the manifest says where they are. Production resolves the same references through `op run` (`deploy/README.md`).

**Tests.** `npm test` (vitest) and `npm run typecheck`. Tests use a temp database via `resetDbForTests` and never call paid APIs. `voice/` has its own `uv run python -m pytest tests`. A `next start` may be serving `.next` on port 3000, so build somewhere else rather than clobbering it.
