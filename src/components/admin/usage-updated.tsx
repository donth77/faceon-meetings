"use client";

import { useTranslations } from "next-intl";

import { publicEnv } from "@/lib/env";

import { useWhen } from "./use-when";

/**
 * When a usage figure was last brought up to date, in the viewer's language and time
 * zone; for Resend's count of the whole account, also where it came from: its list of
 * emails, or its answer to the last email FaceOn sent.
 */
export function UsageUpdated({
  at,
  via,
}: {
  at: string;
  via?: "list" | "headers";
}) {
  const t = useTranslations("Admin.usage");
  const when = useWhen()(at);
  return via
    ? t("emailsVia", { via, when, appName: publicEnv.NEXT_PUBLIC_APP_NAME })
    : t("updated", { when });
}
