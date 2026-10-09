import { execFileSync } from "node:child_process";
import { envPresent } from "./providers/status";

export type ChannelHealth = "simulated" | "configured_untested" | "tested" | "live" | "blocked";

export type ChannelReport = {
  id: string;
  label: string;
  state: ChannelHealth;
  next: string;
};

function ffmpegPresent(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// External providers are live only after a checked call on this machine.
// This module does not place that call. Configured credentials stay "configured_untested".
export function channelReports(options: { ffmpeg?: boolean } = {}): ChannelReport[] {
  const twilio = envPresent("TWILIO_ACCOUNT_SID") && envPresent("TWILIO_AUTH_TOKEN") && envPresent("TWILIO_PHONE_NUMBER");
  const voice = twilio && envPresent("ELEVENLABS_API_KEY") && envPresent("ELEVENLABS_AGENT_ID");
  const mail = envPresent("AGENTMAIL_API_KEY") && envPresent("AGENTMAIL_INBOX_ID") && envPresent("TEST_CUSTOMER_EMAIL");
  const calendar = envPresent("GOOGLE_CLIENT_ID") && envPresent("GOOGLE_CLIENT_SECRET") && envPresent("GOOGLE_REFRESH_TOKEN") && envPresent("GOOGLE_CALENDAR_ID");
  const fal = envPresent("FAL_KEY");
  const ffmpeg = options.ffmpeg ?? ffmpegPresent();
  return [
    {
      id: "phone",
      label: "Phone",
      state: voice ? "configured_untested" : "simulated",
      next: voice
        ? "Place one authorized test call to the designated number. Do not change production forwarding."
        : "Add the voice-agent and telephony credentials, then buy or assign a test number. Inbound calls stay simulated until then.",
    },
    {
      id: "web",
      label: "Website chat",
      state: "tested",
      next: "The application path is covered by automated tests and the examples page. Messages are stored locally and marked simulated. No external chat network is connected.",
    },
    {
      id: "sms",
      label: "SMS and MMS",
      state: twilio ? "configured_untested" : "simulated",
      next: twilio
        ? "Finish sender registration, point the inbound webhook at the test number, and send one message to the designated test recipient."
        : "SMS stays simulated. Registration and a test number are required before a real text is sent. Opt-out handling is already required in the send path.",
    },
    {
      id: "email",
      label: "Email",
      state: mail ? "configured_untested" : "simulated",
      next: mail
        ? "Send one message to the designated test recipient and confirm the webhook."
        : "Add the inbox credentials and the designated test recipient. Other addresses are refused, not delivered.",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      state: "blocked",
      next: "Needs a Meta WhatsApp Business account, a display name, and app approval. Until then, continue the inquiry by SMS or website chat.",
    },
    {
      id: "messenger",
      label: "Facebook Messenger",
      state: "blocked",
      next: "Needs a Facebook app, page access, and app review. Until then, use website chat or email.",
    },
    {
      id: "instagram",
      label: "Instagram messages",
      state: "blocked",
      next: "Needs an Instagram professional account linked to a Facebook page, plus messaging permission. Until then, use website chat or email.",
    },
    {
      id: "tiktok_messages",
      label: "TikTok messages",
      state: "blocked",
      next: "TikTok messaging access is separate from TikTok content publishing. Confirm the current business-messaging application and regional eligibility. Until then, use SMS or website chat.",
    },
    {
      id: "tiktok_publish",
      label: "TikTok publishing",
      state: "blocked",
      next: "Content posting needs its own developer approval and user consent. Drafts can be exported and published by hand.",
    },
    {
      id: "calendar",
      label: "Calendar booking",
      state: calendar ? "configured_untested" : "simulated",
      next: calendar
        ? "Confirm the calendar is a designated test calendar, then book one appointment and check the event id."
        : "Appointments in the new workflow are stored locally and marked simulated until a calendar is connected.",
    },
    {
      id: "listing",
      label: "Google profile edits",
      state: "blocked",
      next: "A public profile URL can start an assessment. Editing the listing needs an owner-authorized connection. Do not treat a public link as permission to publish.",
    },
    {
      id: "fal",
      label: "Image and video generation",
      state: fal ? "configured_untested" : "blocked",
      next: fal
        ? "Run one paid render on a designated test asset and record the cost. This build does not call the provider."
        : "Add FAL_KEY on the server. Drafts are still prepared from job notes, with generation marked not run.",
    },
    {
      id: "ffmpeg",
      label: "Media assembly",
      state: ffmpeg ? "configured_untested" : "blocked",
      next: ffmpeg
        ? "FFmpeg is installed. No render worker has been run in this build. Keep renders in a worker with cancellation and a per-business budget."
        : "Install FFmpeg on the worker that will assemble video. Draft scripts do not need it.",
    },
  ];
}
