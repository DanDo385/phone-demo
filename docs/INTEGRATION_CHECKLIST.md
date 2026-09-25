# Integration checklist

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
