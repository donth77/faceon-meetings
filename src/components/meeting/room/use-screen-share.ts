"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ModerateRequest } from "@/lib/meetings/api";
import { initialArea, type Area } from "@/lib/screen-share/area";
import { captureScreen } from "@/lib/screen-share/capture";
import { cropScreen, type CroppedScreen } from "@/lib/screen-share/crop";

import type { RoomMedia, RoomParticipant, ShareOptions } from "../media";

/** Choosing the part of a screen to share: the screen as captured, and the box to start from. */
export type AreaChoice = {
  screen: MediaStreamTrack;
  area: Area;
  /** Moving the area of a share under way, rather than starting one. */
  changing: boolean;
};

/**
 * Sharing your screen, one person at a time: hosts and co-hosts can take over (after
 * confirming), others are told who's sharing. A host's policy can take sharing away.
 * Part of a screen is captured here, cropped to the area chosen over it, and only that
 * is published, once it's chosen; the area can be moved while it's shared.
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

  const [choice, setChoice] = useState<AreaChoice | null>(null);
  const decide = useRef<((area: Area | null) => void) | null>(null);
  const part = useRef<{
    crop: CroppedScreen;
    screen: MediaStreamTrack;
    area: Area;
  } | null>(null);
  const [sharingPart, setSharingPart] = useState(false);
  // The capture ending by itself (the browser's bar) stops the share through the media's
  // latest functions.
  const latest = useRef(media);
  useEffect(() => {
    latest.current = media;
  });
  // Leaving the room while choosing, or while sharing part of a screen, lets the screen go.
  useEffect(
    () => () => {
      decide.current?.(null);
      part.current?.crop.stop();
    },
    [],
  );

  const presenter = media.participants.find((p) => p.screen && !p.isLocal);
  /** Says why you can't share right now; null when you can. */
  const blocked = !media.screenShare.allowed
    ? () => void toast(t("hostActions.shareLocked"))
    : presenter && !isHost
      ? () => void toast(t("share.someoneSharing", { name: presenter.name }))
      : null;

  /**
   * Part of a screen: the browser's picker, then the area over it; false when either was
   * cancelled. Nothing is sent until the area is chosen.
   */
  async function sharePart(options: ShareOptions): Promise<boolean> {
    if (decide.current) return false;
    const stream = await captureScreen(options);
    const stopCapture = () =>
      stream.getTracks().forEach((track) => track.stop());
    const screen = stream.getVideoTracks()[0];
    if (!screen) {
      stopCapture();
      return false;
    }
    screen.contentHint = options.motion ? "motion" : "detail";
    const { width = 0, height = 0 } = screen.getSettings();
    const area = await new Promise<Area | null>((resolve) => {
      decide.current = resolve;
      // Stopped from the browser's bar while choosing.
      screen.addEventListener("ended", () => resolve(null), { once: true });
      setChoice({ screen, area: initialArea(width, height), changing: false });
    });
    decide.current = null;
    setChoice(null);
    if (!area || screen.readyState === "ended") {
      stopCapture();
      return false;
    }
    const crop = cropScreen(screen, area, () => {
      if (part.current?.crop === crop) void latest.current.screenShare.stop();
    });
    try {
      await latest.current.screenShare.publish(
        new MediaStream([crop.track, ...stream.getAudioTracks()]),
        () => {
          crop.stop();
          part.current = null;
          setSharingPart(false);
          setChoice(null);
        },
      );
    } catch (error) {
      crop.stop();
      stopCapture();
      throw error;
    }
    part.current = { crop, screen, area };
    setSharingPart(true);
    return true;
  }

  /** Shares the screen; false when it didn't start (say, the picker was cancelled). */
  async function share(options: ShareOptions): Promise<boolean> {
    try {
      if (options.part) return await sharePart(options);
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

  /** Moves the area of the part being shared, without stopping the share. */
  function changeArea() {
    const current = part.current;
    if (current) {
      setChoice({ screen: current.screen, area: current.area, changing: true });
    }
  }

  function chooseArea(area: Area) {
    if (!choice?.changing) {
      decide.current?.(area);
      return;
    }
    const current = part.current;
    if (current) {
      current.crop.setArea(area);
      current.area = area;
    }
    setChoice(null);
  }

  function cancelArea() {
    if (choice?.changing) setChoice(null);
    else decide.current?.(null);
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
    /** Choosing the part of a screen to share; null while not. */
    choice,
    chooseArea,
    cancelArea,
    /** Moves the area of the part being shared; null unless part of a screen is shared. */
    changeArea: sharingPart ? changeArea : null,
  };
}
