import { get, getDb } from "../lib/db";
import { generateContentOptions, listAppointments, listInquiries, showJob } from "../lib/ops/workflow";

// scribe inquiries list --business <id>
// scribe jobs show <job-id>
// scribe content generate --job <job-id>
// scribe appointments list --business <id>

getDb();
const [group, action, ...rest] = process.argv.slice(2);

function flag(name: string): string | undefined {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function businessForJob(jobId: string, requested: string | undefined): string {
  const row = get<{ business_id: string }>("SELECT business_id FROM ops_jobs WHERE id = ?", jobId);
  if (!row) fail("Job not found.");
  if (requested && requested !== row.business_id) fail("That job belongs to another business.");
  return row.business_id;
}

if (group === "inquiries" && action === "list") {
  const business = flag("business") || fail("Pass --business <id>");
  console.log(JSON.stringify(listInquiries(business), null, 2));
} else if (group === "jobs" && action === "show") {
  const jobId = rest.find((item) => !item.startsWith("--"));
  if (!jobId) fail("Pass the job id.");
  const business = businessForJob(jobId, flag("business"));
  const job = showJob(business, jobId);
  if (!job) fail("Job not found for that business.");
  console.log(JSON.stringify(job, null, 2));
} else if (group === "content" && action === "generate") {
  const job = flag("job") || fail("Pass --job <job-id>");
  const business = businessForJob(job, flag("business"));
  const result = generateContentOptions({ businessId: business, jobId: job, actor: "cli" });
  if (!result.ok) fail(result.error);
  console.log(JSON.stringify({ ids: result.ids, concepts: result.concepts }, null, 2));
} else if (group === "appointments" && action === "list") {
  const business = flag("business") || fail("Pass --business <id>");
  console.log(JSON.stringify(listAppointments(business), null, 2));
} else {
  fail("Usage: scribe inquiries list --business <id> | scribe jobs show <job-id> | scribe content generate --job <job-id> | scribe appointments list --business <id>");
}
