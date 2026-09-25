export type IntegrationMode = "connected" | "simulated" | "missing";

export type IntegrationReport = {
  id: string;
  label: string;
  mode: IntegrationMode;
  credential: "found" | "missing";
  verified: "verified" | "unverified" | "not_applicable";
  demoResource: string;
  permissions: string;
  remaining: string;
};

export function envPresent(name: string): boolean {
  return Boolean(process.env[name] && process.env[name]!.trim() && !process.env[name]!.includes("replace-with"));
}

export function reports(): IntegrationReport[] {
  const eleven = envPresent("ELEVENLABS_API_KEY");
  const agent = envPresent("ELEVENLABS_AGENT_ID");
  const twilio = envPresent("TWILIO_ACCOUNT_SID") && envPresent("TWILIO_AUTH_TOKEN") && envPresent("TWILIO_PHONE_NUMBER");
  const mail = envPresent("AGENTMAIL_API_KEY") && envPresent("AGENTMAIL_INBOX_ID");
  const google =
    envPresent("GOOGLE_CLIENT_ID") &&
    envPresent("GOOGLE_CLIENT_SECRET") &&
    envPresent("GOOGLE_REFRESH_TOKEN") &&
    envPresent("GOOGLE_CALENDAR_ID");
  const supabase = envPresent("SUPABASE_URL") && envPresent("SUPABASE_SERVICE_ROLE_KEY");
  return [
    {
      id: "elevenlabs",
      label: "ElevenLabs Agents",
      mode: eleven && agent ? "connected" : "simulated",
      credential: eleven ? "found" : "missing",
      verified: "unverified",
      demoResource: agent ? "Configured agent id" : "No demo agent selected",
      permissions: "convai agents, signed URLs, Twilio register-call, speech synthesis",
      remaining: eleven
        ? "Run npm run setup:elevenlabs -- --dry-run and apply only to a designated demo agent."
        : "Unlock 1Password, add ELEVENLABS_API_KEY, and create or select a demo agent. Do not update a production agent.",
    },
    {
      id: "twilio",
      label: "Twilio",
      mode: twilio ? "connected" : "simulated",
      credential: twilio ? "found" : "missing",
      verified: "unverified",
      demoResource: envPresent("TWILIO_PHONE_NUMBER") ? "Configured demo number" : "No demo number selected",
      permissions: "Voice webhooks and call status. API key preferred over the primary auth token.",
      remaining: twilio
        ? "Point the demo number voice webhook at /api/webhooks/twilio/voice. Do not change unrelated numbers."
        : "Add Twilio demo credentials. Forwarding stays simulated until a number is connected.",
    },
    {
      id: "agentmail",
      label: "AgentMail",
      mode: mail && envPresent("TEST_CUSTOMER_EMAIL") ? "connected" : "simulated",
      credential: mail ? "found" : "missing",
      verified: "unverified",
      demoResource: envPresent("AGENTMAIL_INBOX_ID") ? "Configured demo inbox" : "No demo inbox selected",
      permissions: "Send and receive on the demo inbox. Webhook secret for Svix verification.",
      remaining: mail
        ? "Set TEST_CUSTOMER_EMAIL to the designated recipient. Other addresses are refused."
        : "Add AGENTMAIL_API_KEY and AGENTMAIL_INBOX_ID. Messages stay simulated until then.",
    },
    {
      id: "google",
      label: "Google Calendar",
      mode: google ? "connected" : "simulated",
      credential: google ? "found" : "missing",
      verified: "unverified",
      demoResource: envPresent("GOOGLE_CALENDAR_ID") ? "Configured demo calendar" : "Local demo calendar",
      permissions: "OAuth calendar scope on a demo calendar. An API key alone is not enough.",
      remaining: google
        ? "Confirm the calendar is a demo calendar before booking."
        : "Add OAuth client, refresh token, and GOOGLE_CALENDAR_ID. Local bookings stay labeled simulated.",
    },
    {
      id: "supabase",
      label: "Supabase / PostgreSQL",
      mode: supabase ? "missing" : "simulated",
      credential: supabase ? "found" : "missing",
      verified: supabase ? "unverified" : "not_applicable",
      demoResource: "Local SQLite file data/palmetto.sqlite",
      permissions: "Service role would be server-only. This build uses local SQLite because cloud credentials were not available.",
      remaining: supabase
        ? "Credentials were found but this build persists to local SQLite. Migrate before using Supabase."
        : "Local SQLite is the active database. Add Supabase later if you want hosted Postgres.",
    },
  ];
}

export function elevenConfigured(): boolean {
  return envPresent("ELEVENLABS_API_KEY") && envPresent("ELEVENLABS_AGENT_ID");
}

export function twilioConfigured(): boolean {
  return envPresent("TWILIO_ACCOUNT_SID") && envPresent("TWILIO_AUTH_TOKEN") && envPresent("TWILIO_PHONE_NUMBER");
}

// AgentMail itself is set up. Prospect mail needs only this; Palmetto mail also needs the test address.
export function agentMailReady(): boolean {
  return envPresent("AGENTMAIL_API_KEY") && envPresent("AGENTMAIL_INBOX_ID");
}

export function mailConfigured(): boolean {
  return envPresent("AGENTMAIL_API_KEY") && envPresent("AGENTMAIL_INBOX_ID") && envPresent("TEST_CUSTOMER_EMAIL");
}

export function googleConfigured(): boolean {
  return (
    envPresent("GOOGLE_CLIENT_ID") &&
    envPresent("GOOGLE_CLIENT_SECRET") &&
    envPresent("GOOGLE_REFRESH_TOKEN") &&
    envPresent("GOOGLE_CALENDAR_ID")
  );
}
