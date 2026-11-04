"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Chrome's built-in AI doesn't write the reader's language yet, so notes made on this
 * computer come out in English: says so, and that their own AI key gives notes in their
 * language. A notice like the hosting note, on a page or in the (dark) room.
 */
export function EnglishNotesNotice({
  announce = false,
  actions,
}: {
  /** Read out as it appears, since it came with something the person just did. */
  announce?: boolean;
  actions: Array<{ label: string; onPress: () => void }>;
}) {
  const t = useTranslations("Notes");
  const locale = useLocale();
  const language =
    new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  return (
    <div
      role={announce ? "status" : "note"}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100"
    >
      <Languages className="size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-[min(100%,15rem)] flex-1 leading-normal">
        {t("inEnglish", { language })}
      </p>
      {actions.map(({ label, onPress }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          className="border-amber-950/30 bg-transparent hover:bg-amber-950/5 dark:border-amber-100/30 dark:hover:bg-amber-100/10"
          onPress={onPress}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
