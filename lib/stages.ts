import type { StageStatus } from "./types";

export type Stage = {
  id: number;
  key: string;
  title: string;
  status: StageStatus;
  detail: string;
  branch?: boolean;
};

export function deriveStages(input: {
  hasSession: boolean;
  sessionActive: boolean;
  callFailed: boolean;
  continuationStatus?: string | null;
  linkOpened: boolean;
  scheduling: boolean;
  appointment: boolean;
  bookingFailed: boolean;
  invoiceStatus?: string | null;
  reviewStatus?: string | null;
  reminderStatus?: string | null;
}): Stage[] {
  const call: StageStatus = !input.hasSession ? "not_started" : input.callFailed ? "failed" : input.sessionActive ? "active" : "completed";
  let email: StageStatus = "not_started";
  if (input.continuationStatus === "failed") email = "failed";
  else if (input.continuationStatus && input.linkOpened) email = "completed";
  else if (input.continuationStatus) email = "waiting";
  let booking: StageStatus = "not_started";
  if (input.appointment) booking = "completed";
  else if (input.bookingFailed) booking = "failed";
  else if (input.scheduling) booking = "active";
  let invoice: StageStatus = "not_started";
  if (input.invoiceStatus === "email_failed") invoice = "failed";
  else if (input.invoiceStatus === "approved") invoice = "waiting";
  else if (input.invoiceStatus === "emailed" || input.invoiceStatus === "simulated") invoice = "completed";
  let review: StageStatus = "not_started";
  if (input.reviewStatus === "failed") review = "failed";
  else if (input.reviewStatus === "opted_out" || input.reviewStatus === "completed_reported") review = "completed";
  else if (input.reviewStatus) review = "completed";
  let reminder: StageStatus = "not_started";
  if (input.reminderStatus === "pending" || input.reminderStatus === "running") reminder = "waiting";
  else if (input.reminderStatus === "done") reminder = "completed";
  else if (input.reminderStatus === "failed") reminder = "failed";
  else if (input.reminderStatus === "cancelled") reminder = "cancelled";
  return [
    { id: 1, key: "call", title: "Missed call and AI conversation", status: call, detail: call === "active" ? "Conversation in progress" : call === "completed" ? "Call record saved" : "" },
    { id: 2, key: "email", title: "Email continuation", status: email, detail: input.continuationStatus === "simulated" ? "Simulated preview — not delivered" : input.continuationStatus || "", branch: true },
    { id: 3, key: "booking", title: "Appointment booking", status: booking, detail: input.appointment ? "Booked" : "" },
    { id: 4, key: "invoice", title: "Completed service and invoice", status: invoice, detail: input.invoiceStatus || "" },
    { id: 5, key: "review", title: "Customer review invitation", status: review, detail: input.reviewStatus || "" },
    { id: 6, key: "reminder", title: "Review follow-up reminder", status: reminder, detail: input.reminderStatus || "" },
  ];
}
