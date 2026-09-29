// Trades offered on public forms. Stored as the value; shown as the label.
export const TRADES = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac_plumbing", label: "HVAC and plumbing" },
  { value: "other", label: "Other home service" },
] as const;

export type Trade = (typeof TRADES)[number]["value"];
