# Next build

1. Run one authorized phone call on a designated test number and record the result in the channel table. Do not change production forwarding.
2. Point SMS webhooks at that test number after sender registration, and confirm opt-out handling with the designated test recipient.
3. Connect a test calendar and store the provider event id on `ops_appointments` instead of `simulated`.
4. Add the owner-authorized Google profile connection. Keep proposed copy separate from live edits.
5. Put FFmpeg renders in a worker with cancellation, retry, and a per-business budget. Call fal only after `FAL_KEY` is set and a test asset is approved.
6. Finish WhatsApp, Messenger, Instagram, and TikTok as adapters after each approval. Keep TikTok messaging separate from TikTok publishing.
7. Replace the illustrative invoice reference with the business's accounting system. Do not mark a payment confirmed from a note.
8. Move the tenant tables to hosted Postgres if more than one machine must share them. The current database is local SQLite.
