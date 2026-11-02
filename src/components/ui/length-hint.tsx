"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";

/** From this share of the limit on, the hint shows what's left. */
const NEAR = 0.9;

/**
 * A text field's limit, said as it nears: fields stop taking text at their limit, so
 * this says how much is left before that, and that it's reached when it is (announced
 * once, as it happens). Nothing shows while there's plenty of room.
 */
export function LengthHint({
  id,
  length,
  max,
  className,
}: {
  /** For the field's aria-describedby. */
  id: string;
  length: number;
  max: number;
  className?: string;
}) {
  const t = useTranslations("Common");
  if (length < Math.floor(max * NEAR)) return <span id={id} hidden />;
  if (length >= max) {
    return (
      <p
        id={id}
        role="status"
        className={cn("text-destructive-text text-xs", className)}
      >
        {t("lengthReached", { max })}
      </p>
    );
  }
  return (
    <p id={id} className={cn("text-muted-foreground text-xs", className)}>
      {t("lengthLeft", { count: max - length })}
    </p>
  );
}
