import "server-only";

import { z } from "zod";

import { loggable } from "@/lib/log";
import { serverEnv } from "@/lib/server-env";

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

export type NeonUsage =
  | { state: "unconfigured" }
  | { state: "unavailable" }
  | {
      state: "ok";
      /** Compute hours (CU-hours) used this billing period. */
      cuHours: number;
      periodStart: Date | null;
      periodEnd: Date | null;
    };

const instant = (value: string | undefined) => {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
};

/**
 * Reads Neon's answer: the compute time it reports for the current billing period, in
 * CU-hours, and the period itself. Anything it can't read counts as unavailable.
 */
export function readNeonProject(body: unknown): NeonUsage {
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

/**
 * The database's compute hours this billing period, from Neon's API, where
 * NEON_API_KEY and NEON_PROJECT_ID are set (a project-scoped key is enough). Neon
 * reports it on every plan, the Free plan included, though it says the console's
 * Usage page is what's billed. Neon gets 8 seconds to answer.
 */
export async function neonUsage(): Promise<NeonUsage> {
  const { NEON_API_KEY, NEON_PROJECT_ID } = serverEnv();
  if (!NEON_API_KEY || !NEON_PROJECT_ID) return { state: "unconfigured" };
  try {
    const response = await fetch(
      `${PROJECT_URL}/${encodeURIComponent(NEON_PROJECT_ID)}`,
      {
        headers: {
          Authorization: `Bearer ${NEON_API_KEY}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      console.error(`Neon's API answered HTTP ${response.status}.`);
      return { state: "unavailable" };
    }
    return readNeonProject(await response.json());
  } catch (error) {
    console.error("Couldn't ask Neon for its usage.", loggable(error));
    return { state: "unavailable" };
  }
}
