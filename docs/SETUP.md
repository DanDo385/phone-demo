# Setup

## Run locally

```bash
cd /Users/openclaw/Code/phone-demo
cp .env.example .env
npm install
npm test
npm run dev
```

Open http://localhost:3000. Sign in as `alex.rivera@palmetto-coast.demo` with the password in `DEMO_OWNER_PASSWORD` (`palmetto-demo` in the example file).

The database is created at `data/palmetto.sqlite` and seeded on first boot. Reset it by deleting that file.

## 1Password

The CLI was not signed in during implementation. Follow `docs/INTEGRATION_CHECKLIST.md`, then:

```bash
cp .env.op.example .env.op
# edit the op:// references so they point at demo items, not production
op run --env-file=.env.op -- npm run dev
```

`.env` and `.env.op` are gitignored.

## ElevenLabs

Configured languages in the payload: English (`en`) and Spanish (`es`). The language detection system tool is included. Intended speech model: `eleven_turbo_v2_5`. Telephony audio format in the payload: μ-law 8000 Hz. These were **not** applied to an ElevenLabs account in this environment.

```bash
npm run setup:elevenlabs
# writes agent/elevenlabs-agent.payload.json and does not call the API
ELEVENLABS_ALLOW_AGENT_CREATE=true npm run setup:elevenlabs -- --apply
```

`--apply` refuses to update an agent unless `ELEVENLABS_ALLOW_AGENT_UPDATE=true` and the agent name is `Palmetto Coast Demo Receptionist`.

Browser voice uses `GET /v1/convai/conversation/get-signed-url`. The API key stays on the server.

Post-call transcripts: set the agent webhook to `https://YOUR_HOST/api/webhooks/elevenlabs` and `ELEVENLABS_WEBHOOK_SECRET`. Signature header: `ElevenLabs-Signature: t=<unix>,v0=<hex>` over `<timestamp>.<raw body>`, 30-minute window.

Tool webhooks: `POST /api/tools/<name>` with header `x-tool-secret`. Set `TOOL_WEBHOOK_SECRET`.

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
