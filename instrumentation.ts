export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    const { ensureSeed } = await import("./lib/seed");
    const { startScheduler } = await import("./lib/scheduler");
    getDb();
    ensureSeed();
    startScheduler();
  }
}
