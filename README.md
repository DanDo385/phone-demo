# Palmetto Coast Home Services — fictional receptionist demo

A working demo of a multilingual AI receptionist and follow-up flow for independent contractors. The business, customers, prices, and reviews are fictional.

The owner watches a six-stage dashboard. The presenter uses a phone for browser voice or a continuation link. Without ElevenLabs, Twilio, AgentMail, Google Calendar, or Supabase credentials, the same workflow runs in **simulated** mode and says so. It does not pretend a failed send was delivered.

## Quick start

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Then open http://localhost:3000.

- Dashboard: sign in as `alex.rivera@palmetto-coast.demo` / `palmetto-demo`
- Phone: http://localhost:3000/call
- Presenter notes: `docs/PRESENTER.md`
- Customer lines: `docs/SAMPLE_SCRIPTS.md`
- Credentials: `docs/INTEGRATION_CHECKLIST.md` and `docs/SETUP.md`
- What was actually tested: `docs/CAPABILITIES.md`

## What the demo covers

1. Missed call and AI conversation, in English or Spanish.
2. Email continuation under that call, without ending it.
3. Appointment booking during the conversation.
4. Owner-approved demo invoice. No payment is collected.
5. Review invitation to local preview pages.
6. One reminder, with a presenter control that advances a demo clock.

Service area: Port St. Lucie, Tradition, and St. Lucie West. Time zone: America/New_York. The AI speaks English and Spanish. The technicians’ visits are in English.
