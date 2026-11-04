import { cn } from "cn";
import { useTranslations } from "next-intl";

/**
 * The logo's green dot as a status, beside the word: this meeting is live, with someone
 * in its call now (isSessionLive). It says no more than that: no counts, no names. The
 * word carries the meaning, in the green that reads on cards in both themes.
 */
export function LiveBadge({ className }: { className?: string }) {
  const t = useTranslations("Common");
  return (
    <span
      className={cn(
        "text-live-text inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-live animate-live-pulse size-2 rounded-full motion-reduce:animate-none"
      />
      {t("live")}
    </span>
  );
}
