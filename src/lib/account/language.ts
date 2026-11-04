"use server";

import { eq } from "drizzle-orm";
import { hasLocale } from "next-intl";
import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/match";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/** Saves the language on the signed-in account, if there is one. */
async function saveOnAccount(
  locale: string,
  { onlyIfUnset }: { onlyIfUnset: boolean },
): Promise<void> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session || session.user.locale === locale) return;
  if (onlyIfUnset && session.user.locale) return;
  await db().update(user).set({ locale }).where(eq(user.id, session.user.id));
  // Refresh the session's cached copy of the user, so it has the new language at once.
  await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
}

/**
 * Chooses the language FaceOn shows: on this device (the cookie the proxy reads) and,
 * when someone's signed in, on their account too, so their other devices and the
 * emails FaceOn sends them follow it.
 */
export async function chooseLanguageAction(locale: unknown): Promise<boolean> {
  if (typeof locale !== "string" || !hasLocale(routing.locales, locale)) {
    return false;
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  await saveOnAccount(locale, { onlyIfUnset: false });
  return true;
}

/**
 * Gives an account that has no language yet (made before languages were saved) the one
 * this device shows, so its emails come in that language.
 */
export async function rememberLanguageAction(locale: unknown): Promise<void> {
  if (typeof locale !== "string" || !hasLocale(routing.locales, locale)) return;
  await saveOnAccount(locale, { onlyIfUnset: true });
}
