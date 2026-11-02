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
 * through our API, a sound and a pop-up for hosts as each goes up, and a note when a host
 * lowers yours.
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
  // Null until the session's state arrives (and while it's reloaded).
  const known = media.sessionState?.hands ?? null;
  const hands = known ?? NO_HANDS;
  /** You're lowering your own hand: its going down isn't news. */
  const loweringOwn = useRef(false);

  async function changeHand(
    request: Parameters<typeof meetingApi.hand>[1],
  ): Promise<void> {
    const own =
      selfId in hands &&
      ("lowerAll" in request ||
        (!request.raised && (request.target ?? selfId) === selfId));
    if (own) loweringOwn.current = true;
    try {
      await meetingApi.hand(code, request);
    } catch {
      if (own) loweringOwn.current = false;
      toast.error(t("hand.failed"));
    }
  }

  // Hosts hear about each hand that goes up; you hear when a host lowers yours.
  const previous = useRef(hands);
  const announce = useEffectEvent((userId: string) => {
    if (!isHost || userId === selfId) return;
    playSound("handRaised");
    if (!popupHands) return;
    toast(t("hand.someoneRaised", { name: nameOf(userId) }), {
      action: { label: t("hand.view"), onClick: onView },
    });
  });
  const lowered = useEffectEvent(() => {
    if (loweringOwn.current) loweringOwn.current = false;
    else toast(t("hostActions.loweredHand"));
  });
  useEffect(() => {
    if (!known) return;
    const before = previous.current;
    previous.current = known;
    for (const userId of Object.keys(known)) {
      if (!(userId in before)) announce(userId);
    }
    if (selfId in before && !(selfId in known)) lowered();
  }, [known, selfId]);

  return { hands, changeHand };
}
