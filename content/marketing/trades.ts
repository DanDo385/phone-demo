// Industries offered on public forms. Stored as the value; shown as the label.
// High-value categories lead. Plumbing and HVAC stay available as additional examples.
export const TRADES = [
  { value: "roofing", label: "Roofing" },
  { value: "solar", label: "Solar installation" },
  { value: "remodeling", label: "Remodeling" },
  { value: "commercial_construction", label: "Commercial construction" },
  { value: "industrial", label: "Industrial services" },
  { value: "property_management", label: "Property management" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "hvac_plumbing", label: "HVAC and plumbing" },
  { value: "other", label: "Another service business" },
] as const;

export type Trade = (typeof TRADES)[number]["value"];

export const GOALS = [
  { value: "estimates", label: "More estimate requests" },
  { value: "commercial", label: "Commercial leads" },
  { value: "appointments", label: "Appointments" },
  { value: "presentation", label: "A clearer presentation" },
] as const;

export type Goal = (typeof GOALS)[number]["value"];
