# Integration checklist

Checked on this machine on 2026-09-22. No secret values are included.

1Password CLI is installed (`op` 2.33.1) and the desktop app is present. `op account list` shows `my.1password.com` for `djm385@gmail.com`. `op whoami` returned **account is not signed in**. No item metadata was read. No production agent, number, inbox, or calendar was changed.

## Unlock 1Password

1. Open the 1Password app and unlock the `my.1password.com` account.
2. Settings → Security: turn on Touch ID (or the platform authenticator).
3. Settings → Developer: enable **Integrate with 1Password CLI**.
4. In a terminal, run `op signin --account my.1password.com` and approve the prompt.
5. Search item titles only, for example `op item list --format json | jq '.[].title'`, then `op item get "ITEM" --fields label=...`.
6. Put `op://` references in an uncommitted `.env.op` based on `.env.op.example`.
7. Start the app with `op run --env-file=.env.op -- npm run dev`.

Until that succeeds, the app runs on local SQLite and labels provider actions as simulated.

| Integration | Credential | Permissions needed | Connection | Demo resource | Remaining action |
| --- | --- | --- | --- | --- | --- |
| ElevenLabs API key, agent id, voices | Missing | Agents, signed URLs, speech synthesis, Twilio register-call | Unverified | None selected | Unlock 1Password, then dry-run `npm run setup:elevenlabs`. Create or update only an agent named Palmetto Coast Demo Receptionist. |
| Twilio SID, token, demo number | Missing | Voice webhooks on one demo number | Unverified | None selected | Add a demo number. Point Voice to `/api/webhooks/twilio/voice`. Do not import a production number into ElevenLabs. |
| AgentMail key and inbox | Missing | Send and receive on one demo inbox; Svix webhook secret | Unverified | None selected | Set `TEST_CUSTOMER_EMAIL` before any real send. Other recipients are refused. |
| Google Calendar OAuth and calendar id | Missing | Calendar scope via OAuth refresh token. An API key is not enough. | Unverified | Local demo calendar | Authorize a demo calendar only. |
| Supabase / Postgres | Missing | Server-side service role, never in the browser | Not applicable | `data/palmetto.sqlite` | Local SQLite is the active database. |
| Hosting or tunnel | Missing | Public HTTPS for Twilio, ElevenLabs, and AgentMail webhooks | Unverified | `http://localhost:3000` | Use a tunnel you already operate, or ngrok, and set `APP_BASE_URL`. |

Real email and telephone calls stay disabled until `TEST_CUSTOMER_EMAIL` and `TEST_CUSTOMER_PHONE` are set to addresses you designate. No test recipient was found in the environment.
