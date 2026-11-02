"use server";

import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { auth } from "@/lib/auth/server";
import { requireSession } from "@/lib/auth/session";
import { parseAvatarSeed } from "@/lib/avatars/seed";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { aiNotesEnabled } from "@/lib/env";
import { DisplayName } from "@/lib/meetings/api";
import { allowNotesInMeetings } from "@/lib/meetings/notes";

const ACCOUNT_ROUTE = "/settings/account";
const AI_NOTES_ROUTE = "/settings/ai-notes";

const ProfileChange = z
  .object({
    name: DisplayName,
    avatarSeed: z.string().refine((seed) => parseAvatarSeed(seed) !== null),
    avatarSource: z.enum(["dicebear", "provider"]),
  })
  .partial();

/** Settings → Account → Profile: the display name and the avatar. */
export async function updateProfileAction(change: unknown): Promise<boolean> {
  const session = await requireSession(ACCOUNT_ROUTE);
  const parsed = ProfileChange.safeParse(change);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return false;
  await db().update(user).set(parsed.data).where(eq(user.id, session.user.id));
  // Refresh the session's cached copy of the user, so the new name and avatar show at once.
  await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  return true;
}

/**
 * Settings → Account → Set a password, for accounts that signed up with Google or
 * GitHub. Changing an existing password happens in the browser with the current one.
 */
export async function setPasswordAction(
  newPassword: unknown,
): Promise<"ok" | "invalid" | "breached" | "failed"> {
  await requireSession(ACCOUNT_ROUTE);
  const parsed = z
    .string()
    .min(MIN_PASSWORD_LENGTH)
    .max(MAX_PASSWORD_LENGTH)
    .safeParse(newPassword);
  if (!parsed.success) return "invalid";
  try {
    await auth.api.setPassword({
      body: { newPassword: parsed.data },
      headers: await headers(),
    });
    return "ok";
  } catch (error) {
    return isAPIError(error) && error.body?.code === "PASSWORD_COMPROMISED"
      ? "breached"
      : "failed";
  }
}

/**
 * Settings → AI notes: whether meetings you host offer AI notes. It's kept with the
 * account, since co-hosts' requests are checked against it too.
 */
export async function setNotesInMeetingsAction(
  allowed: unknown,
): Promise<boolean> {
  const session = await requireSession(AI_NOTES_ROUTE);
  const parsed = z.boolean().safeParse(allowed);
  if (!parsed.success || !aiNotesEnabled) return false;
  await allowNotesInMeetings(session.user.id, parsed.data);
  return true;
}
