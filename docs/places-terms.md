# Places API caching

Read on 2026-09-29 from the Google Maps Platform Service Specific Terms (non-EEA):

https://cloud.google.com/maps-platform/terms/maps-service-terms

EEA billing accounts use a different set of terms. This note covers the non-EEA terms that page states.

## What Google allows

Section A.3 (Google ID Caching): place_id values from the Places API may be cached indefinitely.

Section 14.3 (Places API, Legacy and New): latitude and longitude may be cached for up to 30 consecutive calendar days, then deleted. The section does not allow caching any other Places content.

## What this app stores

- `prospects.place_id` is kept. That is the place the person confirmed.
- `prospects.place_confirmed` is our own flag, not Places content.
- The person's own words (the name or link they typed, their website, trade, and service area) are kept. Those are form fields, not a Places response.
- A lookup grant stores the place ids from the latest match for about 20 minutes so the confirm step can only accept one of those ids.
- `place_lookups` stores the IP, the place id, and the time, for rate limits. No other Places fields.

The confirm card (name, address, phone, category, rating, review count, website) is rendered from the live lookup response and is not written to SQLite. Coming back to the confirm step runs a new lookup.

Analysis calls Place Details again with the stored place id. The response stays in memory for that run. `sources_json` keeps only whether a place was found, the query string, the place id, and our error text.

We do not request latitude, longitude, reviews, photos, or editorial summaries. The field mask is `PLACE_DETAIL_FIELD_MASK` in `lib/prospect/places.ts`.

The stored analysis is the model's write-up for the owner, not the Places payload. It can mention facts the model saw during that run.
