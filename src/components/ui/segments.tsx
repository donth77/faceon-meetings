"use client";

import { cn } from "cn";
import type { ReactNode } from "react";
import { Radio, RadioGroup } from "react-aria-components";

import { oneOf } from "@/lib/narrow";

/**
 * A segmented control (List | Calendar, Month | Week…): a radio group drawn as joined
 * buttons, with the chosen one raised.
 */
export function Segments<T extends string>({
  label,
  labelledBy,
  value,
  values,
  onChange,
  className,
  children,
}: {
  /** What the choice is about, for screen readers… */
  label?: string;
  /** …or the id of a visible label that says it. */
  labelledBy?: string;
  value: T;
  /** Every value the segments can have. */
  values: readonly T[];
  onChange: (value: T) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <RadioGroup
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      orientation="horizontal"
      value={value}
      onChange={(next) => {
        const chosen = oneOf(values, next);
        if (chosen) onChange(chosen);
      }}
      className={cn(
        "bg-muted ring-border flex rounded-[10px] p-[3px] ring-1 ring-inset dark:bg-white/5",
        className,
      )}
    >
      {children}
    </RadioGroup>
  );
}

export function Segment({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <Radio
      value={value}
      className="text-muted-foreground data-focus-visible:focus-ring data-selected:bg-card data-selected:text-foreground flex h-[34px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium outline-hidden data-selected:font-bold data-selected:shadow-[0_1px_2px_rgba(18,22,28,0.14)] dark:data-selected:bg-white/15"
    >
      {children}
    </Radio>
  );
}
