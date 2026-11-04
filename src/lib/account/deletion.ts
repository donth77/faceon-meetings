import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { meeting, meetingSession } from "@/lib/db/schema";
import { allProviders, mediaProvider } from "@/lib/media";
import { userMediaId } from "@/lib/meetings/principal";
import { reportError } from "@/lib/monitoring/report";

/**
 * Before an account is deleted: end the calls it's hosting right now, so nobody stays in
 * a meeting that's about to disappear. Deleting the user deletes the meetings themselves.
 */
export async function endHostedCalls(userId: string): Promise<void> {
  const open = await db()
    .select({ id: meetingSession.id, provider: meetingSession.provider })
    .from(meetingSession)
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .where(and(eq(meeting.hostId, userId), eq(meetingSession.status, "open")));
  await Promise.all(
    open.map(async (session) => {
      try {
        await mediaProvider(session.provider).endSession(session.id);
      } catch (error) {
        reportError("Could not end a deleted account's call.", error);
      }
    }),
  );
}

/** After an account is deleted: delete what each media provider kept about the person. */
export async function forgetMediaUser(userId: string): Promise<void> {
  await Promise.all(
    allProviders().map(async (provider) => {
      try {
        await provider.forgetUser(userMediaId(userId));
      } catch (error) {
        reportError("Could not delete a user from a media provider.", error, {
          provider: provider.id,
        });
      }
    }),
  );
}
