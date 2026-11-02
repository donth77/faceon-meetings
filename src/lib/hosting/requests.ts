import "server-only";

import { and, asc, count, desc, eq, lt, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hostAllowlist, hostingRequest, user } from "@/lib/db/schema";
import { fetchPage } from "@/lib/pagination";

import { hostingAccessOf } from "./access";
import {
  emailAdminsAboutRequest,
  emailApproved,
  emailDeclined,
} from "./emails";

type Person = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  locale?: string | null;
};

/**
 * Asks the admins to let this person host full meetings. "sent" once it's recorded (the
 * admins get an email); otherwise why not: already full, a request open, or declined too
 * recently to ask again.
 */
export async function askForFullMeetings(
  person: Person,
  note: string | null,
): Promise<"sent" | "full" | "pending" | "declined"> {
  const access = await hostingAccessOf(person);
  if (access.plan === "full") return "full";
  if (access.ask !== "available") return access.ask;
  const inserted = await db()
    .insert(hostingRequest)
    .values({ userId: person.id, note })
    // One open request each: a second at the same moment changes nothing.
    .onConflictDoNothing()
    .returning({ id: hostingRequest.id });
  if (inserted.length === 0) return "pending";
  await emailAdminsAboutRequest({ from: person, note });
  return "sent";
}

/** A page of the open requests, oldest first, with what the admins need to decide. */
export async function openRequests(requested: number) {
  const open = eq(hostingRequest.status, "pending");
  return fetchPage(
    requested,
    async () => {
      const [row] = await db()
        .select({ total: count() })
        .from(hostingRequest)
        .where(open);
      return row?.total ?? 0;
    },
    (offset, limit) =>
      db()
        .select({
          id: hostingRequest.id,
          name: user.name,
          email: user.email,
          note: hostingRequest.note,
          createdAt: hostingRequest.createdAt,
        })
        .from(hostingRequest)
        .innerJoin(user, eq(user.id, hostingRequest.userId))
        .where(open)
        .orderBy(asc(hostingRequest.createdAt), asc(hostingRequest.id))
        .limit(limit)
        .offset(offset),
  );
}

/**
 * A page of the answers, newest first, so admins can see what was decided and by whom:
 * every answer still kept (they go 90 days after, in the daily sweep).
 */
export async function answeredRequests(requested: number) {
  const answered = ne(hostingRequest.status, "pending");
  const decider = db()
    .select({ id: user.id, name: user.name })
    .from(user)
    .as("decider");
  return fetchPage(
    requested,
    async () => {
      const [row] = await db()
        .select({ total: count() })
        .from(hostingRequest)
        .where(answered);
      return row?.total ?? 0;
    },
    (offset, limit) =>
      db()
        .select({
          id: hostingRequest.id,
          name: user.name,
          email: user.email,
          status: hostingRequest.status,
          decidedAt: hostingRequest.decidedAt,
          decidedBy: decider.name,
        })
        .from(hostingRequest)
        .innerJoin(user, eq(user.id, hostingRequest.userId))
        .leftJoin(decider, eq(decider.id, hostingRequest.decidedBy))
        .where(answered)
        .orderBy(
          sql`${hostingRequest.decidedAt} desc nulls last`,
          desc(hostingRequest.id),
        )
        .limit(limit)
        .offset(offset),
  );
}

/**
 * An admin's answer to an open request. Approving adds the person's address to the
 * list; either way they're told by email. False when it was already answered.
 */
export async function decideRequest(input: {
  id: string;
  approve: boolean;
  adminId: string;
}): Promise<boolean> {
  const decided = await db().transaction(async (tx) => {
    const [request] = await tx
      .update(hostingRequest)
      .set({
        status: input.approve ? "approved" : "declined",
        decidedBy: input.adminId,
        decidedAt: new Date(),
      })
      .where(
        and(
          eq(hostingRequest.id, input.id),
          eq(hostingRequest.status, "pending"),
        ),
      )
      .returning({ userId: hostingRequest.userId });
    if (!request) return null;
    const [person] = await tx
      .select({ name: user.name, email: user.email, locale: user.locale })
      .from(user)
      .where(eq(user.id, request.userId))
      .limit(1);
    if (!person) return null;
    if (input.approve) {
      await tx
        .insert(hostAllowlist)
        .values({ email: person.email.toLowerCase(), addedBy: input.adminId })
        .onConflictDoNothing();
    }
    return person;
  });
  if (!decided) return false;
  if (input.approve) emailApproved(decided);
  else emailDeclined(decided);
  return true;
}

/** They saw that they were approved: Home stops saying so. */
export async function markApprovalSeen(userId: string): Promise<void> {
  await db()
    .update(hostingRequest)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(hostingRequest.userId, userId),
        eq(hostingRequest.status, "approved"),
        sql`${hostingRequest.seenAt} is null`,
      ),
    );
}

/** Answered requests are kept 90 days after the answer (retention.ts), then deleted. */
export async function pruneAnsweredRequests(before: Date): Promise<number> {
  const deleted = await db()
    .delete(hostingRequest)
    .where(lt(hostingRequest.decidedAt, before))
    .returning({ id: hostingRequest.id });
  return deleted.length;
}
