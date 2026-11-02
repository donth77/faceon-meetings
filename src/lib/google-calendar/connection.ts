import "server-only";

import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { account, meeting } from "@/lib/db/schema";
import { loggable } from "@/lib/log";
import { serverEnv } from "@/lib/server-env";

import { watchGoogleRefresh, type RefreshWatch } from "./refresh";
import {
  hasCalendarScope,
  withoutCalendarScope,
  type CalendarConnection,
} from "./shared";

const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Whether this copy offers Calendar sync: switched on, with a Google OAuth client. */
export function calendarSyncAvailable(): boolean {
  return (
    serverEnv().GOOGLE_CALENDAR_SYNC === "on" &&
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  );
}

/**
 * The Google account through which someone granted calendar access: the latest, if
 * they somehow linked more than one.
 */
async function calendarAccount(userId: string) {
  const rows = await db()
    .select({
      id: account.id,
      scope: account.scope,
      refreshToken: account.refreshToken,
      updatedAt: account.updatedAt,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));
  return (
    rows
      .filter((row) => hasCalendarScope(row.scope))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null
  );
}

/**
 * Where someone's Google Calendar stands. Connected means Google gave FaceOn a refresh
 * token with calendar access; once Google refuses it, it's a reconnect.
 */
export async function calendarConnection(person: {
  id: string;
  email: string;
}): Promise<CalendarConnection> {
  if (!calendarSyncAvailable()) return { status: "unavailable" };
  const found = await calendarAccount(person.id);
  if (!found) return { status: "disconnected" };
  return found.refreshToken
    ? { status: "connected", email: person.email }
    : { status: "reconnect" };
}

/** Forgets tokens Google no longer accepts, so Settings asks to reconnect. */
export async function forgetCalendarTokens(accountId: string): Promise<void> {
  await db()
    .update(account)
    .set({ accessToken: null, refreshToken: null, accessTokenExpiresAt: null })
    .where(eq(account.id, accountId));
}

export type CalendarAccess =
  | { ok: true; accountId: string; accessToken: string }
  | { ok: false; problem: "reconnect" | "failed" };

/**
 * An access token for someone's calendar, refreshed by Better Auth when it's due.
 * `fresh` refreshes it even when it looks valid, after Google refused it anyway.
 */
export async function calendarAccess(
  userId: string,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<CalendarAccess> {
  const found = await calendarAccount(userId);
  if (!found?.refreshToken) return { ok: false, problem: "reconnect" };
  if (fresh) {
    await db()
      .update(account)
      .set({ accessTokenExpiresAt: new Date(0) })
      .where(eq(account.id, found.id));
  }
  const watch: RefreshWatch = { refused: false };
  try {
    const { accessToken } = await watchGoogleRefresh(watch, () =>
      auth.api.getAccessToken({ body: { accountId: found.id, userId } }),
    );
    if (!accessToken) return { ok: false, problem: "reconnect" };
    return { ok: true, accountId: found.id, accessToken };
  } catch (error) {
    if (watch.refused) {
      await forgetCalendarTokens(found.id);
      return { ok: false, problem: "reconnect" };
    }
    console.error("Could not get a Google Calendar token.", loggable(error));
    return { ok: false, problem: "failed" };
  }
}

/**
 * Asks Google to revoke FaceOn's access. Google's grant covers sign-in too, so the
 * next Google sign-in shows Google's consent screen again. Best effort: a grant that
 * already died needs nothing.
 */
async function revokeGrant(userId: string): Promise<void> {
  const access = await calendarAccess(userId);
  if (!access.ok) return;
  try {
    const response = await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: access.accessToken }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 400) {
      console.error(`Google refused to revoke a grant (${response.status}).`);
    }
  } catch (error) {
    console.error("Could not revoke a Google grant.", loggable(error));
  }
}

/**
 * Disconnects Google Calendar: revokes FaceOn's access, forgets the tokens and the
 * calendar scope, and stops syncing the host's meetings. Events already in the
 * calendar stay there.
 */
export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  const found = await calendarAccount(userId);
  if (found) {
    await revokeGrant(userId);
    await db()
      .update(account)
      .set({
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        scope: withoutCalendarScope(found.scope),
      })
      .where(eq(account.id, found.id));
  }
  await db()
    .update(meeting)
    .set({ googleEvents: null })
    .where(eq(meeting.hostId, userId));
}

/** Before an account is deleted: revoke FaceOn's calendar access, if it has any. */
export async function revokeGoogleCalendar(userId: string): Promise<void> {
  if (await calendarAccount(userId)) await revokeGrant(userId);
}
