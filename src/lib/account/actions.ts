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
import { DisplayName } from "@/lib/meetings/api";

const ACCOUNT_ROUTE = "/settings/account";

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
