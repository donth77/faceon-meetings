import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { hostAllowlist, hostingRequest } from "@/lib/db/schema";
import {
  approvedBySettings,
  hostingPlan,
  type HostingPlan,
} from "@/lib/meetings/hosting";

import { hostingAccess, type HostingAccess } from "./rules";

type Account = { email: string; emailVerified: boolean };

/** Whether an admin approved this address on /admin. */
export async function approvedOnAdmin(email: string): Promise<boolean> {
  const [row] = await db()
    .select({ email: hostAllowlist.email })
    .from(hostAllowlist)
    .where(eq(hostAllowlist.email, email.toLowerCase()))
    .limit(1);
  return row !== undefined;
}

/**
 * Full or demo, from the operator's settings and the admins' list. A session keeps the
 * limits it opened with, so a change applies from someone's next meeting.
 */
export async function hostingPlanOf(host: Account): Promise<HostingPlan> {
  if (!host.emailVerified) return "demo";
  if (approvedBySettings(host.email)) return "full";
  return hostingPlan(host, await approvedOnAdmin(host.email));
}

/** Where a signed-in person stands with hosting full meetings, for Home. */
export async function hostingAccessOf(
  person: Account & { id: string },
  now = new Date(),
): Promise<HostingAccess> {
  const [plan, [latest]] = await Promise.all([
    hostingPlanOf(person),
    db()
      .select({
        status: hostingRequest.status,
        decidedAt: hostingRequest.decidedAt,
        seenAt: hostingRequest.seenAt,
      })
      .from(hostingRequest)
      .where(eq(hostingRequest.userId, person.id))
      .orderBy(desc(hostingRequest.createdAt))
      .limit(1),
  ]);
  return hostingAccess({ plan, latest: latest ?? null, now });
}
