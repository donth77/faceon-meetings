/**
 * Sets up the outside scheduler that sends meeting reminder emails: a cron-job.org job
 * that calls <site>/api/cron/reminders every 5 minutes with "Authorization: Bearer
 * <CRON_SECRET>" (Vercel's free crons run only daily). It creates the job, or updates the
 * one it made before (found by its title), and prints nothing secret.
 *
 *   pnpm cron:setup --url https://joinfaceon.app     (reads .env.production.local)
 *   pnpm cron:setup --check                          (the job's latest runs)
 *
 * Needs CRON_JOB_DOT_ORG_API_KEY (cron-job.org → Settings → API), CRON_SECRET (the same
 * value as in the app's hosting), and the site's address (--url, or NEXT_PUBLIC_APP_URL).
 */
import { z } from "zod";

const API = "https://api.cron-job.org";
const title = `${process.env.NEXT_PUBLIC_APP_NAME || "FaceOn"} reminders`;

const args = process.argv.slice(2);
const check = args.includes("--check");
const urlArg = args[args.indexOf("--url") + 1];
const site = (
  args.includes("--url") ? urlArg : process.env.NEXT_PUBLIC_APP_URL
)?.replace(/\/$/, "");
const apiKey = process.env.CRON_JOB_DOT_ORG_API_KEY;
const secret = process.env.CRON_SECRET;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!apiKey)
  fail("Set CRON_JOB_DOT_ORG_API_KEY (cron-job.org → Settings → API).");

async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    fail(
      `cron-job.org answered ${response.status} to ${init.method ?? "GET"} ${path}.`,
    );
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : {};
}

const Jobs = z.object({
  jobs: z.array(
    z.object({ jobId: z.number(), title: z.string(), url: z.string() }),
  ),
});
const History = z.object({
  history: z.array(
    z.object({
      date: z.number(),
      httpStatus: z.number(),
      statusText: z.string().optional(),
      duration: z.number().optional(),
    }),
  ),
});

const { jobs } = Jobs.parse(await api("/jobs"));
const existing = jobs.find((job) => job.title === title);

if (check) {
  if (!existing)
    fail(`No job called "${title}" yet: run without --check first.`);
  const { history } = History.parse(
    await api(`/jobs/${existing.jobId}/history`),
  );
  console.log(`"${title}" (job ${existing.jobId}) calls ${existing.url}`);
  for (const run of history.slice(0, 5)) {
    console.log(
      `  ${new Date(run.date * 1000).toISOString()}  HTTP ${run.httpStatus}  ${run.statusText ?? ""}  ${run.duration ?? "?"} ms`,
    );
  }
  if (history.length === 0) console.log("  No runs yet.");
  process.exit(0);
}

if (!secret) fail("Set CRON_SECRET, the same value as in the app's hosting.");
if (!site || !/^https:\/\//.test(site)) {
  fail("Give the site's https:// address with --url (or NEXT_PUBLIC_APP_URL).");
}

const job = {
  enabled: true,
  title,
  url: `${site}/api/cron/reminders`,
  saveResponses: true,
  requestMethod: 0, // GET
  requestTimeout: 30,
  redirectSuccess: false,
  extendedData: {
    headers: { Authorization: `Bearer ${secret}` },
    body: "",
  },
  notification: { onFailure: true, onSuccess: false, onDisable: true },
  schedule: {
    timezone: "UTC",
    expiresAt: 0,
    hours: [-1],
    mdays: [-1],
    minutes: Array.from({ length: 12 }, (_, i) => i * 5),
    months: [-1],
    wdays: [-1],
  },
};

if (existing) {
  await api(`/jobs/${existing.jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ job }),
  });
  console.log(
    `Updated "${title}" (job ${existing.jobId}): every 5 minutes, ${job.url}`,
  );
} else {
  const created = z
    .object({ jobId: z.number() })
    .parse(
      await api("/jobs", { method: "PUT", body: JSON.stringify({ job }) }),
    );
  console.log(
    `Created "${title}" (job ${created.jobId}): every 5 minutes, ${job.url}`,
  );
}
