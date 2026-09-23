export type Lang = "en" | "es";
export type LanguageMode = "auto" | Lang;

export type SourceKind = "live" | "post_call" | "simulated" | "simulated_replay";

export type StageStatus =
  | "not_started"
  | "active"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export type ServiceKind = "diagnostic" | "fixed" | "conditional_fixed" | "inspection_required";

export type Bilingual = { en: string; es: string };

export type ToolName =
  | "save_customer_details"
  | "lookup_service_info"
  | "calculate_estimate"
  | "send_continuation_link"
  | "check_availability"
  | "book_appointment"
  | "request_human_followup";

export type Slot = {
  start: string;
  end: string;
  technicianId: string;
  technicianName: string;
  labelEn: string;
  labelEs: string;
};

export type Facts = {
  issue?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  serviceCode?: string;
  inServiceArea?: boolean;
  detailsConfirmed?: boolean;
  estimateExplained?: boolean;
  estimateJson?: string;
  continuationConsent?: boolean;
  continuationSent?: boolean;
  continuationEmailId?: string;
  schedulingStarted?: boolean;
  offeredSlots?: Slot[];
  appointmentId?: string;
  bookingAnnounced?: boolean;
  followupRequested?: boolean;
  photoNote?: boolean;
  dangerousRefused?: boolean;
};

export type DialogueState = {
  language: Lang;
  lock: "explicit" | "detected" | null;
  languageAsked: boolean;
  facts: Facts;
};

export type ToolCall = {
  name: ToolName;
  args: Record<string, unknown>;
  idempotencyKey: string;
};

export type ToolResult = {
  name: ToolName;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  code?: string;
  duplicate?: boolean;
};
