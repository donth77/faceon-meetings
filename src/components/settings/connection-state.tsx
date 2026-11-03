import { cn } from "cn";
import type { ReactNode } from "react";

/** Settings → Calendar's outlined buttons, beside a filled one. */
export const OUTLINE =
  "h-[38px] rounded-[10px] border-[#c9cfd8] px-3.5 text-sm font-semibold dark:border-white/15";

/**
 * Where a connection to Google stands, in Settings → Calendar: an icon, a title, what
 * it means, and what to do.
 */
export function ConnectionState({
  icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  tone: "primary" | "warning";
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-full",
          tone === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
        )}
      >
        {icon}
      </span>
      <span className="text-[17px] leading-snug font-bold">{title}</span>
      <div className="text-muted-foreground flex max-w-[64ch] flex-col gap-1.5 text-sm leading-normal">
        {children}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
