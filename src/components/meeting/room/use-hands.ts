"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";

import { meetingApi } from "../api-client";
import { playSound } from "../chime";
import type { RoomMedia } from "../media";

const NO_HANDS: Record<string, string> = {};

/**
 * Raised hands: who has one up (from the session's shared state), raising and lowering
 * through our API, and a sound and a pop-up for hosts as each goes up.
 */
export function useHands({
  media,
  code,
  selfId,
  isHost,
  popupHands,
  nameOf,
  onView,
}: {
  media: RoomMedia;
  code: string;
  selfId: string;
  isHost: boolean;
  /** Settings → Notifications: a pop-up with each hand. */
  popupHands: boolean;
  nameOf: (userId: string) => string;
  /** Opens Participants, from the pop-up. */
  onView: () => void;
}) {
  const t = useTranslations("Meeting");
  const hands = media.sessionState?.hands ?? NO_HANDS;

  async function changeHand(
    request: Parameters<typeof meetingApi.hand>[1],
  ): Promise<void> {
    try {
      await meetingApi.hand(code, request);
    } catch {
      toast.error(t("hand.failed"));
    }
  }

  // Hosts hear about each hand that goes up.
  const previous = useRef(hands);
  const announce = useEffectEvent((userId: string) => {
    if (!isHost || userId === selfId) return;
    playSound("handRaised");
    if (!popupHands) return;
    toast(t("hand.someoneRaised", { name: nameOf(userId) }), {
      action: { label: t("hand.view"), onClick: onView },
    });
  });
  useEffect(() => {
    const before = previous.current;
    previous.current = hands;
    for (const userId of Object.keys(hands)) {
      if (!(userId in before)) announce(userId);
    }
  }, [hands]);

  return { hands, changeHand };
}
