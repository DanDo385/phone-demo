# Capability table

Verified in this workspace on 2026-09-22 with `npm test` and the local app. Nothing below marked live was executed against ElevenLabs, Twilio, AgentMail, Google, or Supabase.

| Capability | State | Evidence |
| --- | --- | --- |
| English leaking-valve journey: details, conditional price, continuation, booking | Simulated, tested | `tests/journey.test.ts` scenario `en` |
| Spanish journey with the sample opening | Simulated, tested | scenario `es` |
| English then Spanish, then back to English, same inquiry | Simulated, tested | scenario `switch`, two language events, one booking |
| Missed-call forward (ring, no answer, AI) | Simulated replay only | Timeline events `owner_ringing`, `no_answer`, `forwarded`. Live TwiML is implemented and unverified. |
| Browser voice with device speech | Implemented, manual UI | `/call`, labeled browser voice |
| ElevenLabs browser voice and telephony | Blocked | No API key. Signed URL and register-call code are present. |
| Live telephone transcript during the call | Blocked | Post-call import is implemented. The UI says the phone transcript arrives after the call. |
| Owner takeover / barge-in | Not implemented | Dashboard says it is unavailable. ElevenLabs register-call does not support transfer. |
| Continuation email | Simulated, tested | Status `simulated`, not delivered |
| Continuation page, language toggle, upload validation | Implemented | Token expiry tested. Upload type and 5 MB limit enforced. |
| Google Calendar booking | Blocked | Local demo calendar tested, including a conflict that does not confirm |
| Duplicate tool call | Tested | Second book with the same idempotency key is `duplicate`; one appointment remains |
| Invoice PDF and demo banner | Simulated, tested | Owner action `completeDemoService`. No payment collection. |
| Review invitation | Simulated, tested | Local preview pages only. No Yelp request. Click and submit are separate events. |
| 48-hour reminder and demo clock | Tested | One reminder after advancing the clock. Opt-out sends none. Second tick does not duplicate. |
| Dashboard reconnect | Implemented | Events are stored in SQLite and reloaded by polling. |
| Original Spanish kept beside an English translation | Tested | Translation row does not replace the Spanish turn |
| Unsupported language | Tested | French request does not switch the session |
| Supabase | Not used | Local SQLite |
| Recording retention | Off by default | `RECORD_CALLS=false` |

## Language support

| Language | Configured | Voice / model | Tested |
| --- | --- | --- | --- |
| English (`en`) | Yes, in the app and in the ElevenLabs payload | Device speech in the browser. Payload asks for `eleven_turbo_v2_5` and voice slots Avery, Jordan, Riley. No ElevenLabs voice id was verified. | Simulated conversation tested |
| Spanish (`es`) | Yes, including the language-detection system tool in the payload | Same. Spanish greeting is a language preset. Not applied to a live agent. | Simulated conversation tested, including a mid-call switch |
| Any other language | No | — | French request returns the supported-language fallback. Not claimed. |

Configured support and tested support are only English and Spanish, and only through the simulated receptionist. Live ElevenLabs speech was not tested.
