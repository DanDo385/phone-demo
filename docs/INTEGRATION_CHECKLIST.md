# Integration checklist

The 2026-09-24 notes below are historical. This build did not place a carrier call, send a marketing email, buy a number, change DNS, or publish to a client profile.

## This build (2026-10-02)

| Area | State | What was exercised | Next action |
| --- | --- | --- | --- |
| Website assessment | Tested in the browser | `https://example.com` produced cited findings and a labeled sample preview. A request for `http://127.0.0.1:3012/` stored status failed, reason blocked, and did not invent page findings | Run an assessment for a prospect site you are allowed to read |
| Website chat and workflow tools | Tested in the browser and in tests | On `/examples`: a website message stored as simulated, WhatsApp stored as failed, a file attached to the fictional job, Maya's invoice opened after a one-time code, Sam's session refused that invoice, and publishing an approved draft stayed blocked with no URL. Tests cover booking replay, overlap, and payment confirmation | Keep using `/examples` |
| Phone, SMS, email, calendar | Simulated, or configured but untested if credentials are present | Adapters from the earlier sample remain. No new live call was placed | See `lib/channels.ts` for the exact next step |
| WhatsApp, Messenger, Instagram, TikTok messages | Blocked | Documented alternatives are SMS and website chat | Platform app approval. TikTok messaging is separate from TikTok publishing |
| Google profile edits | Blocked | A public URL is stored as a source and is not written back | Owner-authorized connection before any listing change |
| fal and FFmpeg renders | Blocked or installed-but-untested | Draft concepts are stored. Generation is marked not run | Add `FAL_KEY` and run FFmpeg in a worker with a budget |
| Payments | Simulated sample | Confirmation requires `provider_event` or `authorized_action` | Connect the business's accounting system of record |
| Database | Local SQLite | New tables are additive in `lib/db.ts` | Hosted Postgres only if you choose to migrate |

Checked on 2026-09-24 through the `phone-demo-dev` Environment with read-only API calls. No secret values are included.

Credentials come from `.1password/project.toml` → Environment `phone-demo-dev`. See `docs/SETUP.md` → 1Password.
`envsync.py --check` reports no drift.

| Integration | Credential | Verified | Demo resource | Remaining action |
| --- | --- | --- | --- | --- |
| Google Calendar | Found (`Google \| dan@magro.dev` → `oauth_phone_demo`) | Refresh token works. Scopes: `calendar.events`, `calendar.freebusy`. FreeBusy on the demo calendar succeeds. | Agent Phone Demo calendar (dan@magro.dev, Eastern) | None. |
| ElevenLabs | API key and agent id found (agent id not yet in the Environment). Webhook secret empty. | Agent created. A real text-driven conversation called `save_customer_details` and `check_availability` on the public URL and quoted the real first Google slot. | Palmetto Coast Demo Receptionist (`agent_2901m3amewqwe9s8tfb9ptmx41ea`), LLM `claude-haiku-4-5` | Paste the agent id into `ELEVENLABS_AGENT_ID` in the Environment. Set the post-call webhook and its secret. |
| Twilio | SID, auth token, API key found | Account active, **Trial**. **No phone numbers on the account.** `phone_number` in 1Password is marked "not purchased". | None yet | Upgrade the account (trial calls play a notice and reach only verified numbers). Buy the number, then point Voice to `/api/webhooks/twilio/voice` and status to `/api/webhooks/twilio/status`. |
| AgentMail | Key and `inbox_id` found | Inbox `phone-agent@agentmail.to` exists. No webhooks. | phone-agent@agentmail.to | Fill `test_customer_email`. Create the webhook to `/api/webhooks/agentmail` and store its secret. |
| TypeSafe Jev | Found | Not probed | n/a | None. |
| Test recipients | `test_customer_email` / `test_customer_phone` empty | n/a | n/a | Fill both in the Phone Demo item and the Environment. Real email and calls are refused for every other address. |
| Public HTTPS | n/a | `https://phone-demo.magro.dev` → tunnel `magro-mbp-backends` → `127.0.0.1:3000`. Tool route returns 401 without the secret; Twilio webhook returns 403 unsigned. | phone-demo.magro.dev | Change `APP_BASE_URL` in the Environment to `https://phone-demo.magro.dev` (the manifest already says so). The app must be running on port 3000. |
| Supabase / Postgres | Not used | n/a | `data/palmetto.sqlite` | Local SQLite is the active database. |
