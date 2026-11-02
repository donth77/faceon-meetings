"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { ModerateRequest } from "@/lib/meetings/api";

import type { RoomMedia, RoomParticipant, ShareOptions } from "../media";

/**
 * Sharing your screen, one person at a time: hosts and co-hosts can take over (after
 * confirming), others are told who's sharing. A host's policy can take sharing away.
 */
export function useScreenShare({
  media,
  isHost,
  moderate,
}: {
  media: RoomMedia;
  isHost: boolean;
  moderate: (request: ModerateRequest) => Promise<void>;
}) {
  const t = useTranslations("Meeting");
  const [takeover, setTakeover] = useState<{
    presenter: RoomParticipant;
    options: ShareOptions;
  } | null>(null);

  const presenter = media.participants.find((p) => p.screen && !p.isLocal);
  /** Says why you can't share right now; null when you can. */
  const blocked = !media.screenShare.allowed
    ? () => void toast(t("hostActions.shareLocked"))
    : presenter && !isHost
      ? () => void toast(t("share.someoneSharing", { name: presenter.name }))
      : null;

  /** Shares the screen; false when it didn't start (say, the picker was cancelled). */
  async function share(options: ShareOptions): Promise<boolean> {
    try {
      await media.screenShare.start(options);
      return true;
    } catch (error) {
      const cancelled =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "AbortError");
      if (!cancelled) toast.error(t("share.failed"));
      return false;
    }
  }

  function start(options: ShareOptions) {
    if (blocked) blocked();
    else if (presenter) setTakeover({ presenter, options });
    else void share(options);
  }

  async function takeOver() {
    if (!takeover) return;
    setTakeover(null);
    // The picker first, while the click still counts; their share stops once yours starts.
    if (await share(takeover.options)) {
      await moderate({
        action: "mute",
        target: takeover.presenter.userId,
        kind: "screenshare",
      });
    }
  }

  function toggle() {
    if (media.screenShare.enabled) void media.screenShare.stop();
    else start({ audio: true, motion: false });
  }

  return {
    blocked,
    start,
    stop: () => void media.screenShare.stop(),
    toggle,
    /** Whose share a host is about to take over, for the confirmation. */
    takeover: takeover?.presenter.name ?? null,
    takeOver,
    cancelTakeover: () => setTakeover(null),
  };
}
