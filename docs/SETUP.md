# Setup

## Run locally

Secrets come from the 1Password Environment `phone-demo-dev`, described in `.1password/project.toml`
(no secret values). The Environment is mounted at `.env`, so Next.js reads it directly. Never copy
`.env.example` over it.

```bash
cd ~/Code/phone-demo
npm install
npm test
npm run dev              # reads the mounted .env
project-env npm run dev  # same, injected by `op run --environment` (use when .env is not mounted)
```

Open http://localhost:3000. Sign in as `alex.rivera@palmetto-coast.demo` with `DEMO_OWNER_PASSWORD`
(Phone Demo item → `owner_password`).

The database is created at `data/palmetto.sqlite` and seeded on first boot. Reset it by deleting that file.

## 1Password

Two layers:

- **Canonical provider items** in the Dev vault hold what is owned: `ElevenLabs`, `Twilio`
  (sections `account`, `api_key`, `phone`), `AgentMail`, `Google | dan@magro.dev` (section
  `oauth_phone_demo`), `TypeSafe`, and `Phone Demo` for app-level secrets.
- **The `phone-demo-dev` Environment** holds what this app uses. `[variables]` in
  `.1password/project.toml` maps every variable to its canonical `op://` source.

`tsx` scripts do not load `.env`, so run them through the Environment: `project-env npm run <script>`.

When a value changes (a new agent id, a rotated key, a webhook secret):

1. Update the canonical item.
2. Paste the same value into the variable in 1Password → Developer → Environments → `phone-demo-dev`.
   Scripts cannot update an existing Environment variable.
3. Check: `python3 ~/.claude/skills/1password-vault-architect/scripts/envsync.py --check ~/Code/phone-demo`
   reports drift by name only.

Phone numbers may be stored as 10-digit US numbers. `lib/phone.ts` normalizes them to E.164.

## ElevenLabs

Configured languages in the payload: English (`en`) and Spanish (`es`). The language detection system tool is included. Speech models: `eleven_flash_v2` for English (ElevenLabs requires a v2 English model for an English agent) and `eleven_flash_v2_5` in the Spanish preset. Telephony audio format in the payload: μ-law 8000 Hz. The demo agent `Palmetto Coast Demo Receptionist` (`agent_2901m3amewqwe9s8tfb9ptmx41ea`) was created on 2026-09-24.

```bash
project-env npm run setup:elevenlabs
# writes agent/elevenlabs-agent.payload.json and does not call the API
project-env env ELEVENLABS_ALLOW_AGENT_CREATE=true npm run setup:elevenlabs -- --apply
```

`--apply` requires `APP_BASE_URL` to be the public https URL, stores `TOOL_WEBHOOK_SECRET` in the ElevenLabs secret store (`palmetto_tool_webhook_secret`), and saves a new agent id to the ElevenLabs item. It refuses to create a second agent with the demo name, and refuses to update an agent unless `ELEVENLABS_ALLOW_AGENT_UPDATE=true` and the agent name is `Palmetto Coast Demo Receptionist`.

Browser voice uses `GET /v1/convai/conversation/get-signed-url`. The API key stays on the server.

Post-call transcripts: set the agent webhook to `https://YOUR_HOST/api/webhooks/elevenlabs` and `ELEVENLABS_WEBHOOK_SECRET`. Signature header: `ElevenLabs-Signature: t=<unix>,v0=<hex>` over `<timestamp>.<raw body>`, 30-minute window.

Tool webhooks: `POST /api/tools/<name>` with header `x-tool-secret`, sent by ElevenLabs from its secret store. `inquiry_id` comes from the `inquiry_id` dynamic variable, set by register-call (telephone) and `startSession` (browser). The default LLM is `claude-haiku-4-5` for phone latency; override with `ELEVENLABS_LLM`.

## Twilio

Intended flow, implemented in `/api/webhooks/twilio/voice`:

1. Incoming call.
2. Dial `OWNER_FORWARD_NUMBER` for 12 seconds.
3. If the owner answers, hang up. The AI is not connected.
4. On no-answer, busy, failed, or canceled, register the call with ElevenLabs `POST /v1/convai/twilio/register-call` and return that TwiML.
5. If the caller is the demo number itself, or the call was already forwarded, refuse another forward.

Without Twilio credentials the forwarding sequence is available as a **simulated replay** from the dashboard. The live webhook returns 403 until `TWILIO_AUTH_TOKEN` is set. `TWILIO_ALLOW_UNSIGNED=true` is only for a local signed-request test.

Set the number’s Voice webhook to `https://YOUR_HOST/api/webhooks/twilio/voice`, method POST. Status callback: `/api/webhooks/twilio/status`.

Recording is off unless `RECORD_CALLS=true`. This demo does not request a recording.

## AgentMail

`POST https://api.agentmail.to/v0/inboxes/{inbox_id}/messages/send` with `Authorization: Bearer`.

Webhooks use Svix (`svix-id`, `svix-timestamp`, `svix-signature`). Point them at `/api/webhooks/agentmail` for `message.received`, `message.sent`, `message.delivered`, and `message.bounced`.

A message is sent only when AgentMail is configured **and** the recipient equals `TEST_CUSTOMER_EMAIL`. Otherwise the dashboard shows `simulated` or `failed`, never delivered.

## Google Calendar

OAuth refresh token with calendar scope. FreeBusy, then insert, on `GOOGLE_CALENDAR_ID`. If Google is not configured, bookings are stored in the local demo calendar and labeled simulated. If Google is configured and the insert fails, the appointment is not confirmed.

## Supabase

Not connected. Local SQLite is the development database. Do not put a service-role key in client code.

## Prospect demo (`/try`)

A visitor enters their website, Google Business Profile, email, and the mobile number they will call from.

1. `POST /api/prospects` (capped at `PROSPECT_LIMIT_PER_HOUR`, default 3, per IP) starts the analysis:
   Firecrawl reads the homepage plus up to three service/about/contact pages, the Places API (New)
   finds the profile, and Claude (`PROSPECT_ANALYSIS_MODEL`, default `claude-opus-5`) returns a
   business profile with invented filler marked `filler: true`, a gap report, enhancements, and a
   voice script. The report is emailed to the visitor through AgentMail.
2. `/try/<id>` renders from `GET /api/prospects/<id>/events` (server-sent events): call panel, live
   transcript, call flow, gaps, a mock calendar (`lib/prospect/calendar.ts`), and enhancements.
3. Calls reach the ElevenLabs agent `Receptionist Demo (prospects)` (`ELEVENLABS_PROSPECT_AGENT_ID`):
   - Phone: the Twilio voice webhook matches caller ID to a prospect from the last 24 hours, else the
     most recent one from the last 15 minutes, and registers the call with the prospect's dynamic variables.
   - Browser: `POST /api/prospects/<id>/browser-call` returns a signed URL and dynamic variables.
4. The agent uses a custom LLM: ElevenLabs calls `POST /api/llm/v1/chat/completions` with
   `Authorization: Bearer LLM_RELAY_SECRET` and `x-prospect-id` / `x-conversation-id` headers. The relay
   (`lib/prospect/relay.ts`) swaps in the prospect's script, calls Claude (`PROSPECT_VOICE_MODEL`,
   default `claude-opus-5` at `PROSPECT_VOICE_EFFORT=low`; `claude-haiku-4-5` roughly halves time to
   first word), streams OpenAI-format chunks back, and records every line for the live transcript.
5. Tools: `POST /api/prospect-tools/{check_availability,book_appointment,take_message}` on the mock calendar.
6. When the call ends (Twilio status callback, browser hang-up, or 90 s idle), Claude summarizes it and
   the transcript and summary are emailed to the visitor's address.

Prospect email goes only to the address typed on the form (report once, then once per call). The
demo number is shown only after Twilio confirms the account owns `TWILIO_PHONE_NUMBER`.

```bash
project-env npm run setup:prospect-agent            # dry run
project-env npm run setup:prospect-agent -- --apply # create or update (requires public APP_BASE_URL)
```

## Self-hosted voice (prototype)

`voice/` is a Pipecat service that can answer prospect phone calls instead of ElevenLabs,
using open-weight speech models (Parakeet, Kokoro) and the same relay. Set
`PROSPECT_VOICE_ENGINE=selfhosted` and `VOICE_STREAM_URL` to switch. Architecture, setup,
test harness and measured latency are in `voice/README.md`.
