import "server-only";

import { reportError } from "@/lib/monitoring/report";
import { serverEnv } from "@/lib/server-env";
import { z } from "@/lib/zod";

import { isFresh, lastReading, saveReading } from "./readings";

const PROJECT_URL = "https://console.neon.tech/api/v2/projects";

/** The part of Neon's project details the meter reads. */
const Project = z.object({
  project: z.object({
    /** CU-seconds this billing period: compute size × time running. */
    compute_time_seconds: z.number().nonnegative(),
    consumption_period_start: z.string().optional(),
    consumption_period_end: z.string().optional(),
  }),
});

/** What Neon reports: compute hours (CU-hours) this billing period, and the period. */
export type NeonFigures = {
  cuHours: number;
  periodStart: Date | null;
  periodEnd: Date | null;
};

export type NeonUsage =
  | { state: "unconfigured" }
  | { state: "unavailable" }
  | ({ state: "ok"; readAt: Date } & NeonFigures);

/** The figures as kept between readings (readings.ts). */
const Kept = z.object({
  cuHours: z.number().nonnegative(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
});

const instant = (value: string | undefined) => {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
};

/**
 * Reads Neon's answer: the compute time it reports for the current billing period, in
 * CU-hours, and the period itself. Anything it can't read counts as unavailable.
 */
export function readNeonProject(
  body: unknown,
): ({ state: "ok" } & NeonFigures) | { state: "unavailable" } {
  const parsed = Project.safeParse(body);
  if (!parsed.success) return { state: "unavailable" };
  const project = parsed.data.project;
  return {
    state: "ok",
    cuHours: project.compute_time_seconds / 3600,
    periodStart: instant(project.consumption_period_start),
    periodEnd: instant(project.consumption_period_end),
  };
}

/** Asks Neon for the project's figures; 8 seconds to answer. */
async function askNeon(
  key: string,
  projectId: string,
): Promise<({ state: "ok" } & NeonFigures) | { state: "unavailable" }> {
  try {
    const response = await fetch(
      `${PROJECT_URL}/${encodeURIComponent(projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      reportError("Neon's API refused a request.", undefined, {
        status: response.status,
      });
      return { state: "unavailable" };
    }
    return readNeonProject(await response.json());
  } catch (error) {
    reportError("Couldn't ask Neon for its usage.", error);
    return { state: "unavailable" };
  }
}

/**
 * The database's compute hours this billing period, from Neon's API, where
 * NEON_API_KEY and NEON_PROJECT_ID are set (a project-scoped key is enough). Neon
 * reports it on every plan, the Free plan included, though it says the console's Usage
 * page is what's billed. It's asked at most every five minutes (always, with `force`),
 * and when it can't answer, the last reading stands, with its time.
 */
export async function neonUsage(
  now = new Date(),
  force = false,
): Promise<NeonUsage> {
  const { NEON_API_KEY, NEON_PROJECT_ID } = serverEnv();
  if (!NEON_API_KEY || !NEON_PROJECT_ID) return { state: "unconfigured" };
  const last = await lastReading("neon");
  const kept = Kept.safeParse(last?.data).data;
  const previous: NeonUsage | null =
    last && kept
      ? {
          state: "ok",
          cuHours: kept.cuHours,
          periodStart: instant(kept.periodStart ?? undefined),
          periodEnd: instant(kept.periodEnd ?? undefined),
          readAt: last.readAt,
        }
      : null;
  if (!force && previous && isFresh(last, now)) return previous;
  const asked = await askNeon(NEON_API_KEY, NEON_PROJECT_ID);
  if (asked.state !== "ok") return previous ?? asked;
  await saveReading(
    "neon",
    {
      cuHours: asked.cuHours,
      periodStart: asked.periodStart?.toISOString() ?? null,
      periodEnd: asked.periodEnd?.toISOString() ?? null,
    },
    now,
  );
  return { ...asked, readAt: now };
}
