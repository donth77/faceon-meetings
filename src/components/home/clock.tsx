"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { useIntlLocale } from "@/lib/preferences";

const MINUTE = 60_000;

function subscribe(onTick: () => void) {
  const timer = window.setInterval(onTick, 10_000);
  return () => window.clearInterval(timer);
}

/** The current minute. Stable between minutes, so the clock re-renders only when it changes. */
const getMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;

/**
 * Home's big clock and date, in the viewer's locale and time zone. Rendered only in the
 * browser (the server can't know the viewer's time zone).
 */
export function Clock() {
  const locale = useIntlLocale();
  const t = useTranslations("Home");
  const minute = useSyncExternalStore(subscribe, getMinute, () => null);

  if (minute === null) {
    return <div className="h-24" aria-hidden="true" />;
  }

  const now = new Date(minute);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <div role="group" aria-label={t("clockLabel")} className="flex flex-col">
      <time
        dateTime={now.toISOString()}
        className="font-display text-5xl font-bold tabular-nums sm:text-6xl"
      >
        {time}
      </time>
      <span className="text-muted-foreground text-lg">{date}</span>
    </div>
  );
}
