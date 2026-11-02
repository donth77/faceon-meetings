"use client";

import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { useIntlLocale } from "@/lib/preferences";

/** Formats an ISO moment as a date and time, in the viewer's language and time zone. */
export function useWhen(): (iso: string) => string {
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  return (iso) => format.format(new Date(iso));
}
