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
  calendarEvent?: boolean;
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
  const callDetail =
    call === "failed"
      ? "The receptionist connection failed. This is not a completed call."
      : call === "active"
        ? "Conversation in progress"
        : call === "completed"
          ? "Call record saved"
          : "";
  const emailDetail =
    input.continuationStatus === "failed"
      ? "Continuation email failed"
      : input.continuationStatus === "simulated"
        ? "Simulated preview — not delivered"
        : input.continuationStatus === "sent" || input.continuationStatus === "delivered"
          ? "Provider accepted the continuation email"
          : input.continuationStatus || "";
  const bookingDetail = input.appointment
    ? input.calendarEvent
      ? "Calendar event recorded · not a dispatch"
      : "Local demo hold · not dispatched"
    : input.bookingFailed
      ? "That time was not confirmed"
      : "";
  const invoiceDetail = !input.invoiceStatus
    ? ""
    : input.invoiceStatus === "email_failed"
      ? "Invoice email failed · no payment was collected"
      : "Demo invoice · no payment due";
  const reviewDetail =
    input.reviewStatus === "completed_reported"
      ? "Customer said they already reviewed · not checked, not posted"
      : input.reviewStatus === "opted_out"
        ? "Opted out · nothing was posted publicly"
        : input.reviewStatus === "failed"
          ? "Invitation failed · nothing was posted"
          : input.reviewStatus
            ? "Invitation only · not posted publicly"
            : "";
  const reminderDetail =
    reminder === "waiting"
      ? "Scheduled on the demo clock"
      : reminder === "completed"
        ? "One reminder prepared"
        : reminder === "failed"
          ? "Reminder failed"
          : reminder === "cancelled"
            ? "Cancelled · a second reminder was not created"
            : "";
  return [
    { id: 1, key: "call", title: "Missed call and AI conversation", status: call, detail: callDetail },
    { id: 2, key: "email", title: "Email continuation", status: email, detail: emailDetail, branch: true },
    { id: 3, key: "booking", title: "Appointment booking", status: booking, detail: bookingDetail },
    { id: 4, key: "invoice", title: "Completed service and invoice", status: invoice, detail: invoiceDetail },
    { id: 5, key: "review", title: "Customer review invitation", status: review, detail: reviewDetail },
    { id: 6, key: "reminder", title: "Review follow-up reminder", status: reminder, detail: reminderDetail },
  ];
}
