import { Icon, type IconName } from "@/components/marketing/Icon";
import { deriveStages } from "@/lib/stages";

// Stub until the interactive journey lands: the real stage logic (lib/stages.ts) rendered
// for one finished sample job from the fictional Palmetto Coast demo. The status lines are
// what the dashboard itself would show, including "not delivered" and "not dispatched".
const SAMPLE = deriveStages({
  hasSession: true,
  sessionActive: false,
  callFailed: false,
  continuationStatus: "simulated",
  linkOpened: true,
  scheduling: false,
  appointment: true,
  bookingFailed: false,
  calendarEvent: false,
  invoiceStatus: "simulated",
  reviewStatus: "clicked",
  reminderStatus: "done",
});

const ICONS: IconName[] = ["phone", "mail", "calendar", "invoice", "star", "reminder"];

export function JobJourneyDemo({ label }: { label: string }) {
  return (
    <figure className="m-journey">
      <ol className="m-journey-steps">
        {SAMPLE.map((stage, i) => (
          <li key={stage.key} className="m-journey-step">
            <span className="m-journey-icon"><Icon name={ICONS[i] ?? "check"} /></span>
            <span>
              <strong>{stage.title}</strong>
              {stage.detail && <small>{stage.detail}</small>}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="m-fine"><span className="m-tag">Sample</span> {label}</figcaption>
    </figure>
  );
}
