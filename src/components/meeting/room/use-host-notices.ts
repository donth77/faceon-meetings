"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";

import type { SharedSessionState } from "@/lib/meetings/events";

import type { RoomMedia } from "../media";
import { moderates, type RoomRole } from "./roles";

/**
 * Tells you what hosts did that affects you: muted you, stopped your video or screen
 * share, made you a co-host, spotlighted you, or changed what everyone may do. Also
 * notices when a host asks you to unmute (only our server can send that).
 */
export function useHostNotices({
  media,
  selfId,
  selfRole,
}: {
  media: RoomMedia;
  selfId: string;
  selfRole: RoomRole;
}) {
  const t = useTranslations("Meeting.hostActions");
  const [unmuteAsked, setUnmuteAsked] = useState(false);
  const { subscribeHostMutes, subscribeEvents, sessionState: state } = media;
  const micOn = useEffectEvent(() => media.mic.enabled);

  useEffect(
    () =>
      subscribeHostMutes((kind) => {
        if (kind === "audio") toast(t("mutedYou"));
        else if (kind === "video") toast(t("stoppedVideo"));
        else toast(t("stoppedShare"));
      }),
    [subscribeHostMutes, t],
  );

  useEffect(
    () =>
      subscribeEvents((event, sender) => {
        if (
          sender === null &&
          event.type === "host.request_unmute" &&
          event.target === selfId &&
          !micOn()
        ) {
          setUnmuteAsked(true);
        }
      }),
    [subscribeEvents, selfId],
  );

  const previousRole = useRef(selfRole);
  useEffect(() => {
    const before = previousRole.current;
    previousRole.current = selfRole;
    if (selfRole === "cohost" && before !== "cohost") toast(t("nowCohost"));
    if (before === "cohost" && selfRole === "participant") {
      toast(t("noLongerCohost"));
    }
  }, [selfRole, t]);

  const previous = useRef<SharedSessionState | null>(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (!before || !state) return;
    if (state.spotlight === selfId && before.spotlight !== selfId) {
      toast(t("spotlightedYou"));
    }
    // Hosts and co-hosts aren't held to these, and see them in Host controls.
    if (moderates(selfRole)) return;
    if (before.chat !== state.chat) toast(t(state.chat ? "chatOn" : "chatOff"));
    if (before.reactions !== state.reactions) {
      toast(t(state.reactions ? "reactionsOn" : "reactionsOff"));
    }
    if (before.screenShare !== state.screenShare) {
      toast(t(state.screenShare === "all" ? "shareAll" : "shareHostOnly"));
    }
    if (before.selfUnmute !== state.selfUnmute) {
      toast(t(state.selfUnmute ? "micsOn" : "micsOff"));
    }
  }, [state, selfId, selfRole, t]);

  return { unmuteAsked, dismissUnmute: () => setUnmuteAsked(false) };
}
