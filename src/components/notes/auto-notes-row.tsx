"use client";

import { useTranslations } from "next-intl";

import { SwitchRow } from "@/components/ui/form-fields";
import { aiNotesEnabled } from "@/lib/env";

/**
 * "Start AI notes automatically", for a meeting you host: on the schedule form, the
 * meeting's page and the personal room's. Only where your meetings offer AI notes
 * (Settings → AI notes); otherwise nothing mentions them.
 */
export function AutoNotesRow({
  allowed,
  isSelected,
  onChange,
}: {
  /** Your meetings offer AI notes (Settings → AI notes). */
  allowed: boolean;
  isSelected: boolean;
  onChange: (on: boolean) => void;
}) {
  const t = useTranslations("Notes.auto");
  if (!aiNotesEnabled || !allowed) return null;
  return (
    <SwitchRow
      label={t("label")}
      help={t("help")}
      isSelected={isSelected}
      onChange={onChange}
    />
  );
}

/**
 * "Share AI notes with participants automatically", beside it: notes made in the meeting
 * are saved to it and shared with everyone who was in it with an account, as soon as
 * they're made. Hidden in the same places.
 */
export function ShareNotesRow({
  allowed,
  isSelected,
  onChange,
}: {
  /** Your meetings offer AI notes (Settings → AI notes). */
  allowed: boolean;
  isSelected: boolean;
  onChange: (on: boolean) => void;
}) {
  const t = useTranslations("Notes.autoShare");
  if (!aiNotesEnabled || !allowed) return null;
  return (
    <SwitchRow
      label={t("label")}
      help={t("help")}
      isSelected={isSelected}
      onChange={onChange}
    />
  );
}
