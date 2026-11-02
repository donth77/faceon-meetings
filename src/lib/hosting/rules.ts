/**
 * Asking to host full meetings, as pure rules: what someone sees about it, from their
 * plan and their latest request, and when they may ask. lib/hosting/requests.ts keeps
 * the requests; lib/meetings/hosting.ts decides the plan.
 */
import { z } from "zod";

import type { HostingPlan } from "@/lib/meetings/hosting";

/** After a decline, how long before someone may ask again. */
export const ASK_AGAIN_AFTER_DAYS = 30;

/** The note someone may send with a request, for the admins. */
export const RequestNote = z.string().trim().max(500);

export const REQUEST_STATUSES = ["pending", "approved", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** The person's latest request, as far as these rules need it. */
export type LatestRequest = {
  status: RequestStatus;
  decidedAt: Date | null;
  /** When they saw that it was approved, so Home says so once. */
  seenAt: Date | null;
} | null;

/** Where someone stands with hosting full meetings. */
export type HostingAccess =
  /** `justApproved`: an approval they haven't seen yet. */
  | { plan: "full"; justApproved: boolean }
  | { plan: "demo"; ask: "available" }
  | { plan: "demo"; ask: "pending" }
  /** Declined lately; they may ask again from `askAgainAt`. */
  | { plan: "demo"; ask: "declined"; askAgainAt: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

export function hostingAccess(input: {
  plan: HostingPlan;
  latest: LatestRequest;
  now: Date;
}): HostingAccess {
  const { plan, latest, now } = input;
  if (plan === "full") {
    return {
      plan,
      justApproved: latest?.status === "approved" && latest.seenAt === null,
    };
  }
  if (latest?.status === "pending") return { plan, ask: "pending" };
  if (latest?.status === "declined" && latest.decidedAt) {
    const askAgainAt = new Date(
      latest.decidedAt.getTime() + ASK_AGAIN_AFTER_DAYS * DAY_MS,
    );
    if (askAgainAt > now) return { plan, ask: "declined", askAgainAt };
  }
  // Never asked, declined long ago, or approved and later moved back to demos.
  return { plan, ask: "available" };
}
