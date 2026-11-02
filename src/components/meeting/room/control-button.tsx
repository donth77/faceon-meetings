"use client";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import type { Ref } from "react";
import { Button, type ButtonProps } from "react-aria-components";

export type ControlTone = "plain" | "danger" | "amber";

const TONES: Record<ControlTone, string> = {
  plain: "text-foreground bg-white/10 group-hover:bg-white/15",
  danger: "bg-destructive group-hover:bg-destructive/90 text-white",
  amber: "bg-hand text-hand-foreground group-hover:bg-hand/90",
};

/**
 * A round control with its label underneath (hidden on phones). Also usable as the
 * trigger of a menu, popover or tooltip, which pass a ref and handlers through.
 */
export function ControlButton({
  icon: Icon,
  label,
  tone = "plain",
  ref,
  ...props
}: Omit<ButtonProps, "children" | "className"> & {
  icon: LucideIcon;
  label: string;
  /** Red for a muted mic or stopped camera; amber for a raised hand. */
  tone?: ControlTone;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <Button
      {...props}
      ref={ref}
      aria-label={label}
      className="group flex flex-col items-center gap-1.5 rounded-xl px-0.5 py-1 outline-none md:w-[88px]"
    >
      <span
        className={cn(
          "group-focus-visible:focus-ring flex size-14 items-center justify-center rounded-full transition-colors max-[400px]:size-11 md:size-11",
          TONES[tone],
        )}
      >
        <Icon className="size-6 md:size-[22px]" aria-hidden="true" />
      </span>
      <span className="text-foreground/80 max-w-[86px] text-center text-xs leading-[15px] max-md:hidden">
        {label}
      </span>
    </Button>
  );
}
