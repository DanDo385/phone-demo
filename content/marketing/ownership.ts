import { brand, ownershipPromise } from "@/lib/brand";

// Who owns each asset, how we get access, and how the client takes it back.
export const ownershipColumns = ["Asset", "Owner", "How we get access", "How you revoke it"] as const;

export const ownershipRows = [
  ["Domain", "Client registrar account", "Authorized DNS connection", "Remove the DNS role"],
  ["Website", "Client", "Hosting, TLS, backups, and an export", "Files and DNS handoff"],
  ["Google profile", "Client", "Manager / OAuth", "Remove manager"],
  ["Phone number", "Client business", "Twilio subaccount / port authority", "Port-out package"],
  ["Workspace", "Client", "OAuth scopes", "Revoke token"],
  ["Payments", "Client merchant", "Connected account", "Disconnect/export"],
] as const;

export const ownershipPage = {
  meta: { title: "Ownership", description: ownershipPromise },
  headline: "You own it. We operate it.",
  promise: ownershipPromise,
  body: `Everything ${brand.company.shortName} runs for you stays in your business's name. The domain stays in your registrar account. We work through access you grant and can take back, and we never ask for your passwords. Publishing a new site or a listing change requires your authorization.`,
  leaving: {
    heading: "If you leave",
    points: [
      "Remove our access from each account yourself, or ask us to do it and confirm.",
      "Your number moves with a port-out package. Your domain and website come with the files and DNS settings.",
      "Your job records, recordings, and media are exported to you.",
    ],
  },
} as const;
