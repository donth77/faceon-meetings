"use client";

import { cn } from "cn";
import { Hand, MicOff, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode, Ref } from "react";
import { Button } from "react-aria-components";

import { useNow } from "@/hooks/use-now";
import type { SessionInfo } from "@/lib/meetings/api";

import { clock, limitShown } from "./top-bar";

/**
 * Where the top or bottom controls sit. In a large room they're part of the layout. In a
 * phone-sized one they float over the video with a shade behind them, and fade while the
 * controls step aside (use-auto-hide.ts); `data-room-controls` marks them for it.
 */
export function ControlsLayer({
  edge,
  compact,
  hidden,
  children,
  ref,
}: {
  edge: "top" | "bottom";
  compact: boolean;
  hidden: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  // Not the room's direct children in a large room: React Aria resets those as menus close.
  if (!compact) return <div className="contents">{children}</div>;
  return (
    <div
      ref={ref}
      data-room-controls={edge}
      className={cn(
        "absolute inset-x-0 z-20 transition duration-200 ease-out motion-reduce:transition-none",
        edge === "top"
          ? "top-0 bg-gradient-to-b from-black/75 via-black/40 to-transparent pb-3"
          : "bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent pt-5",
        hidden && "pointer-events-none opacity-0",
        hidden && (edge === "top" ? "-translate-y-2" : "translate-y-2"),
      )}
    >
      {children}
    </div>
  );
}

/**
 * While the controls are away, what you'd want to see at a glance: your mic is off,
 * your hand is up, AI notes are on, the time left. Seen only: each of these is also
 * announced when it changes.
 */
export function HiddenStatus({
  muted,
  handRaised,
  notesOn,
  session,
  endsAt,
}: {
  muted: boolean;
  handRaised: boolean;
  notesOn: boolean;
  session: SessionInfo;
  endsAt: number | null;
}) {
  const now = useNow(1000);
  const timeLeft =
    endsAt !== null && limitShown(session, endsAt, now) && now !== null
      ? clock(Math.max(0, Math.round((endsAt - now) / 1000)))
      : null;
  if (!muted && !handRaised && !notesOn && timeLeft === null) return null;
  return (
    // Top centre, clear of the tiles' corner badges and menus.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-10 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/65 p-1.5 text-white"
    >
      {muted ? (
        <span className="bg-destructive flex size-7 items-center justify-center rounded-full">
          <MicOff className="size-4" />
        </span>
      ) : null}
      {handRaised ? (
        <span className="bg-hand text-hand-foreground flex size-7 items-center justify-center rounded-full">
          <Hand className="size-4" />
        </span>
      ) : null}
      {notesOn ? (
        <span className="bg-primary/35 flex size-7 items-center justify-center rounded-full">
          <Sparkles className="size-4" />
        </span>
      ) : null}
      {timeLeft ? (
        <span className="px-1.5 font-mono text-[13px] tabular-nums">
          {timeLeft}
        </span>
      ) : null}
    </div>
  );
}

/** The first time the controls step aside on this device, how to get them back. */
export function TapHint() {
  const t = useTranslations("Meeting");
  return (
    <p
      aria-hidden="true"
      // Above your floating tile and the names along the bottom.
      className="pointer-events-none absolute inset-x-0 bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+6.5rem))] z-10 flex justify-center"
    >
      <span className="rounded-full bg-black/70 px-3.5 py-1.5 text-sm text-white">
        {t("tapToShowControls")}
      </span>
    </p>
  );
}

/**
 * For screen readers while the controls are away (a tap on the video isn't how they'd
 * find them): shows the controls and keeps them up.
 */
export function ShowControlsButton({ onPress }: { onPress: () => void }) {
  const t = useTranslations("Meeting");
  return (
    <Button onPress={onPress} className="sr-only">
      {t("showControls")}
    </Button>
  );
}
