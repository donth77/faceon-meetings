"use client";

import { useLocale } from "next-intl";

import { speechLanguage } from "@/lib/notes/speech";

/** The language AI notes listen for: the app's, in this browser's regional form. */
export function useSpeechLanguage(): string {
  const locale = useLocale();
  return speechLanguage(
    locale,
    typeof navigator === "undefined" ? [] : navigator.languages,
  );
}
