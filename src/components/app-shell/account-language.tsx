"use client";

import { hasLocale, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/match";
import { routing } from "@/i18n/routing";
import { rememberLanguageAction } from "@/lib/account/language";

/**
 * Keeps this device in step with the account's language. An account's language wins over
 * the one this device had (it was chosen in Settings, perhaps on another device), and an
 * account with none yet takes this device's, so its emails come in that language.
 */
export function AccountLanguage({
  saved,
}: {
  saved: string | null | undefined;
}) {
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (!saved) {
      void rememberLanguageAction(locale);
    } else if (saved !== locale && hasLocale(routing.locales, saved)) {
      document.cookie = `${LOCALE_COOKIE}=${saved}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      router.refresh();
    }
  }, [saved, locale, router]);

  return null;
}
