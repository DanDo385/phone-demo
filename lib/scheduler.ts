import { tickReminders } from "./reminders";

let started = false;

export function startScheduler(): void {
  if (started || process.env.SCHEDULER_DISABLED === "1") return;
  started = true;
  const timer = setInterval(() => {
    void tickReminders().catch(() => undefined);
  }, 5000);
  timer.unref?.();
}
