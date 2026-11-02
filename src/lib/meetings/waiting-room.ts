import "server-only";

import { and, count, eq, gt, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { admissionRequest, meetingSession } from "@/lib/db/schema";
import { mediaProvider } from "@/lib/media";

import { requireMeeting, requireMember, requirePrincipal } from "./access";
import { admit } from "./admission";
import type { AdmissionResponse, LobbyAction, LobbyEntry } from "./api";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import { findOpenSession, type MeetingSession } from "./queries";
import { isHostRole } from "./rules";

/**
 * A request lives this long without a poll. Phones pause background tabs, so someone
 * who looks away keeps their place; a closed tab cancels its request as it goes.
 */
export const REQUEST_TTL_MS = 10 * 60 * 1000;

const freshSince = (now: Date) => new Date(now.getTime() - REQUEST_TTL_MS);

/** Tells the session's hosts the waiting room changed. The event carries no names. */
async function notifyHosts(session: MeetingSession, now: Date): Promise<void> {
  const [row] = await db()
    .select({ waiting: count() })
    .from(admissionRequest)
    .where(
      and(
        eq(admissionRequest.sessionId, session.id),
        eq(admissionRequest.status, "pending"),
        gt(admissionRequest.lastSeenAt, freshSince(now)),
      ),
    );
  await mediaProvider(session.provider).sendServerEvent(session.id, {
    type: "lobby.updated",
    count: row?.waiting ?? 0,
  });
}

/** How often hosts turned this person away in this session. */
export async function timesDenied(
  sessionId: string,
  mediaUserId: string,
): Promise<number> {
  const [row] = await db()
    .select({ denied: count() })
    .from(admissionRequest)
    .where(
      and(
        eq(admissionRequest.sessionId, sessionId),
        eq(admissionRequest.mediaUserId, mediaUserId),
        eq(admissionRequest.status, "denied"),
      ),
    );
  return row?.denied ?? 0;
}

/** Puts someone in the waiting room (or keeps their place) and tells the hosts. */
export async function askToJoin(input: {
  session: MeetingSession;
  principal: Principal;
  name: string;
}): Promise<string> {
  const { session, principal } = input;
  const now = new Date();
  const [row] = await db()
    .insert(admissionRequest)
    .values({
      sessionId: session.id,
      mediaUserId: principal.mediaUserId,
      userId: principal.kind === "user" ? principal.userId : null,
      displayName: input.name,
      image: principal.image,
    })
    .onConflictDoUpdate({
      target: [admissionRequest.sessionId, admissionRequest.mediaUserId],
      targetWhere: sql`${admissionRequest.status} = 'pending'`,
      set: { displayName: input.name, lastSeenAt: now },
    })
    .returning({ id: admissionRequest.id });
  if (!row) throw new Error("Could not ask to join.");
  await notifyHosts(session, now);
  return row.id;
}

/** The caller's own request, or NOT_FOUND. */
async function ownRequest(requestId: string, principal: Principal) {
  const [request] = await db()
    .select()
    .from(admissionRequest)
    .where(eq(admissionRequest.id, requestId))
    .limit(1);
  if (!request || request.mediaUserId !== principal.mediaUserId) {
    throw new MeetingError("NOT_FOUND");
  }
  return request;
}

/**
 * The waiting person's poll: still waiting, turned away, timed out, or let in, in which
 * case this admits them and returns their media token.
 */
export async function pollAdmission(input: {
  code: string;
  requestId: string;
  principal: Principal | null;
}): Promise<AdmissionResponse> {
  const now = new Date();
  const { meeting, host } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  const request = await ownRequest(input.requestId, principal);
  const session = await findOpenSession(meeting.id);
  if (!session || session.id !== request.sessionId) return { state: "expired" };

  switch (request.status) {
    case "pending": {
      if (request.lastSeenAt < freshSince(now)) {
        await db()
          .update(admissionRequest)
          .set({ status: "expired" })
          .where(eq(admissionRequest.id, request.id));
        return { state: "expired" };
      }
      await db()
        .update(admissionRequest)
        .set({ lastSeenAt: now })
        .where(eq(admissionRequest.id, request.id));
      return { state: "waiting" };
    }
    case "admitted":
      return admit({
        meeting,
        host,
        session,
        principal,
        name: request.displayName,
        role: principal.kind === "guest" ? "guest" : "participant",
        now,
      });
    case "denied":
      return { state: "denied" };
    default:
      return { state: "expired" };
  }
}

/** The waiting person gives up (Cancel, or closing the tab). */
export async function cancelAdmission(input: {
  code: string;
  requestId: string;
  principal: Principal | null;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  const request = await ownRequest(input.requestId, principal);
  const cancelled = await db()
    .update(admissionRequest)
    .set({ status: "cancelled", decidedAt: new Date() })
    .where(
      and(
        eq(admissionRequest.id, request.id),
        eq(admissionRequest.status, "pending"),
      ),
    )
    .returning({ id: admissionRequest.id });
  const session = await findOpenSession(meeting.id);
  if (cancelled.length > 0 && session?.id === request.sessionId) {
    await notifyHosts(session, new Date());
  }
}

/** The open session, for one of its hosts or co-hosts; NOT_ALLOWED for anyone else. */
async function hostedSession(code: string, principal: Principal | null) {
  const { meeting } = await requireMeeting(code);
  const { session, member } = await requireMember(
    meeting.id,
    requirePrincipal(principal),
  );
  if (!isHostRole(member.role)) throw new MeetingError("NOT_ALLOWED");
  return session;
}

/** Who's waiting, oldest first, for the session's hosts and co-hosts. */
export async function lobby(input: {
  code: string;
  principal: Principal | null;
}): Promise<LobbyEntry[]> {
  const session = await hostedSession(input.code, input.principal);
  const rows = await db()
    .select()
    .from(admissionRequest)
    .where(
      and(
        eq(admissionRequest.sessionId, session.id),
        eq(admissionRequest.status, "pending"),
        gt(admissionRequest.lastSeenAt, freshSince(new Date())),
      ),
    )
    .orderBy(admissionRequest.createdAt)
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    name: row.displayName,
    image: row.image,
    guest: row.userId === null,
    askedAt: row.createdAt.toISOString(),
  }));
}

/**
 * Hosts admit or deny. Only requests still pending change, so two hosts deciding at
 * once can't both act on the same person.
 */
export async function decide(input: {
  code: string;
  principal: Principal | null;
  action: LobbyAction;
}): Promise<void> {
  const session = await hostedSession(input.code, input.principal);
  await settle(session, input.action);
}

/** Lets everyone waiting in: the waiting room was turned off. */
export async function admitEveryone(session: MeetingSession): Promise<void> {
  await settle(session, { action: "admitAll" });
}

async function settle(
  session: MeetingSession,
  action: LobbyAction,
): Promise<void> {
  const now = new Date();
  await db()
    .update(admissionRequest)
    .set({
      status: action.action === "deny" ? "denied" : "admitted",
      decidedAt: now,
    })
    .where(
      and(
        eq(admissionRequest.sessionId, session.id),
        eq(admissionRequest.status, "pending"),
        gt(admissionRequest.lastSeenAt, freshSince(now)),
        action.action === "admitAll"
          ? undefined
          : inArray(admissionRequest.id, action.ids),
      ),
    );
  await notifyHosts(session, now);
}

/** Drops waiting-room records a while after their session ended. */
export async function pruneEndedSessionRequests(before: Date): Promise<number> {
  const ended = db()
    .select({ id: meetingSession.id })
    .from(meetingSession)
    .where(
      and(
        eq(meetingSession.status, "ended"),
        lt(meetingSession.endedAt, before),
      ),
    );
  const deleted = await db()
    .delete(admissionRequest)
    .where(inArray(admissionRequest.sessionId, ended))
    .returning({ id: admissionRequest.id });
  return deleted.length;
}
