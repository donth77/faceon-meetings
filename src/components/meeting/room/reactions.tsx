"use client";

import { SmilePlus } from "lucide-react";
import { useTranslations } from "next-intl";
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
            className={`${EMOJI_FONT} focus-visible:ring-ring flex size-[54px] items-center justify-center rounded-full text-[30px] leading-none outline-none hover:bg-white/10 focus-visible:ring-2 data-[pressed]:scale-90`}
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
  return (
    <div className="flex">
      <DialogTrigger>
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

/**
 * Reactions float up from the bottom-left of the stage with the sender's name; with
 * reduced motion they appear without moving. Decorative: tiles carry the same news.
 */
export function FloatingReactions({
  reactions,
  nameOf,
}: {
  reactions: LiveReaction[];
  nameOf: (userId: string) => string;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-4 left-4 z-10 h-[400px] w-60 overflow-hidden"
    >
      {reactions.slice(-12).map((reaction) => (
        <div
          key={reaction.id}
          style={{ left: (reaction.id % 4) * 12 }}
          className="animate-reaction-float absolute bottom-0 flex items-center gap-1.5 motion-reduce:animate-[reaction-fade_3.5s_ease-out_forwards]"
        >
          <span className={`${EMOJI_FONT} text-[38px] leading-none`}>
            {emojiFor(reaction.code)}
          </span>
          <span className="rounded-[10px] bg-[#0e1013]/85 px-2 py-0.5 text-xs font-semibold text-white">
            {nameOf(reaction.userId)}
          </span>
        </div>
      ))}
    </div>
  );
}

export { EMOJI_FONT };
