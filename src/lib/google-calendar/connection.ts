import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { account, meeting } from "@/lib/db/schema";
import { reportError } from "@/lib/monitoring/report";
import { serverEnv } from "@/lib/server-env";

import { googleClientConfigured } from "./client";
import { watchGoogleRefresh, type RefreshWatch } from "./refresh";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_SCRIPT_SCOPE,
  hasScope,
  withoutScope,
  type CalendarConnection,
  type GoogleScope,
} from "./shared";

const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Whether this copy offers Calendar sync: switched on, with a Google OAuth client. */
export function calendarSyncAvailable(): boolean {
  return serverEnv().GOOGLE_CALENDAR_SYNC === "on" && googleClientConfigured();
}

/**
 * The Google account through which someone granted `scope`: the latest, if they
 * somehow linked more than one, or the one whose Google ID is `googleSub`.
 */
async function googleAccountWith(
  userId: string,
  scope: GoogleScope,
  googleSub?: string,
) {
  const rows = await db()
    .select({
      id: account.id,
      googleSub: account.accountId,
      scope: account.scope,
      refreshToken: account.refreshToken,
      providerEmail: account.providerEmail,
      updatedAt: account.updatedAt,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));
  return (
    rows
      .filter(
        (row) =>
          hasScope(row.scope, scope) &&
          (googleSub === undefined || row.googleSub === googleSub),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null
  );
}

/**
 * Where someone's Google Calendar stands, with the connected Google account's email,
 * which can differ from theirs (lib/auth/linking-rules.ts). Connected means Google gave
 * FaceOn a refresh token with calendar access; once Google refuses it, it's a reconnect.
 */
export async function calendarConnection(person: {
  id: string;
  email: string;
}): Promise<CalendarConnection> {
  if (!calendarSyncAvailable()) return { status: "unavailable" };
  const found = await googleAccountWith(person.id, GOOGLE_CALENDAR_SCOPE);
  if (!found) return { status: "disconnected" };
  return found.refreshToken
    ? {
        status: "connected",
        email: found.providerEmail ?? person.email,
      }
    : { status: "reconnect" };
}

/**
 * The email of someone's linked Google account (the latest, if they somehow linked more
 * than one), for Settings to show; null without one, or when Google didn't say. It's
 * the email from the account's ID token, which isn't kept (`withoutIdToken`).
 */
export async function googleAccountEmail(
  userId: string,
): Promise<string | null> {
  const [latest] = await db()
    .select({ email: account.providerEmail })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
    .orderBy(desc(account.updatedAt))
    .limit(1);
  return latest?.email ?? null;
}

/** Whether someone gave FaceOn `scope` with a grant it can still use. */
export async function hasGoogleGrant(
  userId: string,
  scope: GoogleScope,
): Promise<boolean> {
  return Boolean((await googleAccountWith(userId, scope))?.refreshToken);
}

/** Forgets tokens Google no longer accepts, so Settings asks to reconnect. */
export async function forgetGoogleTokens(accountId: string): Promise<void> {
  await db()
    .update(account)
    .set({ accessToken: null, refreshToken: null, accessTokenExpiresAt: null })
    .where(eq(account.id, accountId));
}

export type GoogleAccess =
  | {
      ok: true;
      accountId: string;
      /** The Google account's own ID (its `sub`). */
      googleSub: string;
      accessToken: string;
    }
  | { ok: false; problem: "reconnect" | "failed" };

/**
 * An access token with `scope` (from the Google account `googleSub`, when given),
 * refreshed by Better Auth when it's due. `fresh` refreshes it even when it looks
 * valid, after Google refused it anyway.
 */
export async function googleAccess(
  userId: string,
  scope: GoogleScope,
  { fresh = false, googleSub }: { fresh?: boolean; googleSub?: string } = {},
): Promise<GoogleAccess> {
  const found = await googleAccountWith(userId, scope, googleSub);
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
    return {
      ok: true,
      accountId: found.id,
      googleSub: found.googleSub,
      accessToken,
    };
  } catch (error) {
    if (watch.refused) {
      await forgetGoogleTokens(found.id);
      return { ok: false, problem: "reconnect" };
    }
    reportError("Could not get a Google token.", error);
    return { ok: false, problem: "failed" };
  }
}

/** An access token for someone's calendar (googleAccess). */
export function calendarAccess(
  userId: string,
  options: { fresh?: boolean } = {},
): Promise<GoogleAccess> {
  return googleAccess(userId, GOOGLE_CALENDAR_SCOPE, options);
}

/**
 * Asks Google to revoke FaceOn's access. Google's grant covers sign-in and every scope
 * together, so the next Google sign-in shows Google's consent screen again. Best effort:
 * a grant that already died needs nothing.
 */
async function revokeGrant(userId: string, scope: GoogleScope): Promise<void> {
  const access = await googleAccess(userId, scope);
  if (!access.ok) return;
  try {
    const response = await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: access.accessToken }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 400) {
      reportError("Google refused to revoke a grant.", undefined, {
        status: response.status,
      });
    }
  } catch (error) {
    reportError("Could not revoke a Google grant.", error);
  }
}

/**
 * FaceOn stops using `scope`. Google revokes a grant only whole, so when the same
 * account's grant still serves the other scope (Calendar sync, or the add-on), FaceOn
 * only forgets this one; otherwise it revokes the grant and forgets the tokens.
 */
async function releaseScope(userId: string, scope: GoogleScope): Promise<void> {
  const found = await googleAccountWith(userId, scope);
  if (!found) return;
  const other =
    scope === GOOGLE_CALENDAR_SCOPE
      ? GOOGLE_SCRIPT_SCOPE
      : GOOGLE_CALENDAR_SCOPE;
  const stillUsed = Boolean(found.refreshToken) && hasScope(found.scope, other);
  if (!stillUsed) await revokeGrant(userId, scope);
  await db()
    .update(account)
    .set({
      ...(stillUsed
        ? {}
        : {
            accessToken: null,
            refreshToken: null,
            accessTokenExpiresAt: null,
          }),
      scope: withoutScope(found.scope, scope),
    })
    .where(eq(account.id, found.id));
}

/**
 * Disconnects Google Calendar: FaceOn lets go of its calendar access (releaseScope) and
 * stops syncing the host's meetings. Events already in the calendar stay there.
 */
export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  await releaseScope(userId, GOOGLE_CALENDAR_SCOPE);
  await stopCalendarSync(userId);
}

/** FaceOn stops keeping the host's meetings in their calendar; the events stay. */
export async function stopCalendarSync(userId: string): Promise<void> {
  await db()
    .update(meeting)
    .set({ googleEvents: null })
    .where(eq(meeting.hostId, userId));
}

/** FaceOn lets go of the add-on's access to Apps Script (releaseScope). */
export async function releaseScriptAccess(userId: string): Promise<void> {
  await releaseScope(userId, GOOGLE_SCRIPT_SCOPE);
}

/**
 * When FaceOn won't have the tokens any more (the account is deleted, or Google is
 * removed from it): revokes FaceOn's access, if it has any. A grant already revoked
 * for the other scope is simply refused again.
 */
export async function revokeGoogleAccess(userId: string): Promise<void> {
  for (const scope of [GOOGLE_CALENDAR_SCOPE, GOOGLE_SCRIPT_SCOPE] as const) {
    if (await hasGoogleGrant(userId, scope)) await revokeGrant(userId, scope);
  }
}
