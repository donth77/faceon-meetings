import { cn } from "cn";
import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-chip text-chip-foreground",
  ai: "bg-ai-soft text-ai",
} as const;

/** A small rounded label: Host, Invited, 45 min, AI notes saved… */
export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-xl px-2 text-xs font-bold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
