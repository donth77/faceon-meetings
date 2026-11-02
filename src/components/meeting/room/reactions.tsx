"use client";

import { SmilePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
  Toolbar,
} from "react-aria-components";

import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { emojiFor, REACTIONS, type ReactionCode } from "@/lib/meetings/events";

import { ControlButton } from "./control-button";
import type { LiveReaction } from "./use-reactions";

const EMOJI_FONT =
  "font-['Noto_Color_Emoji','Apple_Color_Emoji','Segoe_UI_Emoji',sans-serif]";

/** The six reactions in a row; arrow keys move between them and Enter sends. */
export function ReactionPicker({
  onSend,
}: {
  onSend: (code: ReactionCode) => void;
}) {
  const t = useTranslations("Meeting.reactions");
  return (
    <Toolbar aria-label={t("label")} className="flex items-center gap-0.5">
      {REACTIONS.map((reaction) => (
        <TooltipTrigger key={reaction.code} delay={300}>
          <Button
            aria-label={t(`names.${reaction.name}`)}
            onPress={() => onSend(reaction.code)}
            className={`${EMOJI_FONT} focus-visible:focus-ring flex size-[54px] items-center justify-center rounded-full text-[30px] leading-none outline-hidden hover:bg-white/10 data-[pressed]:scale-90`}
          >
            {reaction.emoji}
          </Button>
          <Tooltip>{t(`names.${reaction.name}`)}</Tooltip>
        </TooltipTrigger>
      ))}
    </Toolbar>
  );
}

/** Reactions: a pill of six emoji above the button, as in Meet and Zoom. */
export function ReactionsControl({
  onSend,
}: {
  onSend: (code: ReactionCode) => void;
}) {
  const t = useTranslations("Meeting.reactions");
  const [open, setOpen] = useState(false);

  // The bar stays open for a burst, as in Meet. Escape closes it: listened for on the
  // window, first, because an emoji's tooltip takes Escape for itself, and pressing a
  // key shows the focused emoji's tooltip again, so Escape would never get past it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  return (
    <div className="flex">
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <ControlButton icon={SmilePlus} label={t("label")} />
        <Popover
          placement="top"
          offset={10}
          className="dark rounded-full bg-[#262b33] px-2 py-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.55)] ring-1 ring-[#3a424d]"
        >
          <Dialog aria-label={t("label")} className="outline-none">
            <ReactionPicker onSend={onSend} />
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}

/** A steady spread for each reaction, from its ID: where it starts and how it sways. */
const spreadOf = (id: number) => ({
  // Inside the area, with room for the sway and the name chip on either side.
  x: 28 + ((id * 53) % 150),
  sway: 8 + ((id * 17) % 16),
  rise: 3.6 + (id % 5) * 0.22,
  swayFor: 1.3 + (id % 3) * 0.25,
});

/**
 * Reactions float up the stage, as in Meet: each its own bubble with the sender's name
 * ("You" for yours), rising and swaying, the emoji wiggling as it goes, so a burst is a
 * stream. Without animation (Settings → Reactions, or reduced motion) they appear and
 * fade in place. Decorative: tiles carry the same news, and screen readers hear it.
 */
export function FloatingReactions({
  reactions,
  nameOf,
  selfId,
  animate,
}: {
  reactions: LiveReaction[];
  nameOf: (userId: string) => string;
  selfId: string;
  animate: boolean;
}) {
  const t = useTranslations("Meeting.chat");
  return (
    <div
      aria-hidden="true"
      className="[container-type:size] pointer-events-none absolute top-4 bottom-4 left-2 z-10 w-80 max-w-[calc(100%-1rem)] overflow-hidden"
    >
      {reactions.map((reaction) => {
        const spread = spreadOf(reaction.id);
        const mine = reaction.userId === selfId;
        return (
          <div
            key={reaction.id}
            style={
              {
                left: spread.x,
                "--rise-for": `${spread.rise}s`,
                "--sway": `${spread.sway}px`,
                "--sway-for": `${spread.swayFor}s`,
              } as React.CSSProperties
            }
            className={
              animate
                ? "animate-reaction-rise motion-reduce:animate-reaction-fade absolute bottom-0"
                : "animate-reaction-fade absolute bottom-0"
            }
          >
            <div
              className={
                animate
                  ? "animate-reaction-sway flex flex-col items-center gap-1 motion-reduce:animate-none"
                  : "flex flex-col items-center gap-1"
              }
            >
              <span
                className={`${EMOJI_FONT} ${animate ? "animate-reaction-wiggle motion-reduce:animate-none" : ""} text-[38px] leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]`}
              >
                {emojiFor(reaction.code)}
              </span>
              <span
                className={
                  mine
                    ? "max-w-28 truncate rounded-full bg-[#a8c7fa] px-2.5 py-0.5 text-xs font-semibold text-[#062e6f]"
                    : "max-w-28 truncate rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-[#12161c]"
                }
              >
                {mine ? t("you") : nameOf(reaction.userId)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { EMOJI_FONT };
