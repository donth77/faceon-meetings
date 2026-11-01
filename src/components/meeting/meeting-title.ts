"use client";

import { useTranslations } from "next-intl";

import { firstName } from "@/lib/names";

/** A meeting's title, or the default ("Maya's meeting") in the viewer's language. */
export function useMeetingTitle(meeting: {
  title: string | null;
  hostName: string;
}): string {
  const t = useTranslations("Meeting");
  return (
    meeting.title ?? t("defaultTitle", { name: firstName(meeting.hostName) })
  );
}
