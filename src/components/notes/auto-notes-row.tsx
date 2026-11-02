"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { SwitchRow } from "@/components/ui/form-fields";
import { aiNotesEnabled } from "@/lib/env";

/**
 * "Start AI notes automatically", for a meeting you host: on the schedule form, the
 * meeting's page and the personal room's. Where your account doesn't allow AI notes yet
 * (Settings → AI notes), it's unavailable and says where to turn them on.
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
  if (!aiNotesEnabled) return null;
  return (
    <SwitchRow
      label={t("label")}
      help={
        allowed
          ? t("help")
          : t.rich("off", {
              settings: (chunks) => (
                <Link
                  href="/settings/ai-notes"
                  className="text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })
      }
      isSelected={allowed && isSelected}
      isDisabled={!allowed}
      onChange={onChange}
    />
  );
}
