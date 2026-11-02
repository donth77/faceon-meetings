import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Grey shapes where a page's content is about to appear, so a navigation shows the
 * page at once and its details fill in, rather than a blank space that pops.
 */
export function CardsLoading({
  rows = 3,
  heading = true,
  className,
}: {
  rows?: number;
  /** A short line above the cards, like a day or section heading. */
  heading?: boolean;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={cn("flex flex-col gap-3", className)}>
      {heading ? (
        <Skeleton className="h-4 w-40 motion-reduce:animate-none" />
      ) : null}
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className="h-[76px] rounded-2xl motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

/** A tall card or two, for pages that are one big form or panel. */
export function PanelLoading({
  height = "h-80",
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={cn("flex flex-col gap-4", className)}>
      <Skeleton className="h-8 w-56 motion-reduce:animate-none" />
      <Skeleton
        className={cn("rounded-2xl motion-reduce:animate-none", height)}
      />
    </div>
  );
}
