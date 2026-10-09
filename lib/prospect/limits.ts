// Caps for paid Places and analysis calls. The analysis cap is the existing per-IP limit.
// Lookups have their own per-IP cap so a search can be retried, plus a per-place cap.

export function hourAgo(): string {
  return new Date(Date.now() - 3_600_000).toISOString();
}

export function tenMinutesAgo(): string {
  return new Date(Date.now() - 600_000).toISOString();
}

function positive(value: string | undefined, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function analysisLimitPerHour(): number {
  return positive(process.env.PROSPECT_LIMIT_PER_HOUR, 3);
}

export function placeLimitPerHour(): number {
  return positive(process.env.PROSPECT_PLACE_LIMIT_PER_HOUR, analysisLimitPerHour());
}

export function lookupLimitPerHour(): number {
  return positive(process.env.PROSPECT_LOOKUP_LIMIT_PER_HOUR, 15);
}

export const AUTOCOMPLETE_LIMIT = 60;
