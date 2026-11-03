"use client";

import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

/**
 * Home's one-time card offering an app: the web app's install on phones
 * (components/pwa/install-app.tsx), the desktop app on a Mac or Windows
 * (components/desktop/download.tsx). An icon, a title, a line, its buttons and an
 * optional note. `actions` gets `close`, which puts the card away for good; focus moves
 * to the page first, since the button pressed goes with the card.
 */
export function OneTimeCard({
  label,
  icon: Icon,
  title,
  body,
  actions,
  note,
  onDismiss,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  actions: (close: () => void) => ReactNode;
  note?: ReactNode;
  onDismiss: () => void;
  className?: string;
}) {
  const id = useId();
  const close = () => {
    if (document.getElementById(id)?.contains(document.activeElement)) {
      document.getElementById("main")?.focus();
    }
    onDismiss();
  };

  return (
    <section
      id={id}
      aria-label={label}
      className={`bg-card ring-border flex flex-col gap-3 rounded-2xl p-4.5 ring-1 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="bg-chip text-chip-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-muted-foreground text-sm leading-normal">{body}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{actions(close)}</div>
      {note ? (
        <p className="text-muted-foreground text-[13px] leading-normal">
          {note}
        </p>
      ) : null}
    </section>
  );
}
