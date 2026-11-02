"use client";

import { cn } from "cn";
import {
  Hand,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { TrackView, useRoomMedia, type RoomParticipant } from "../media";
import { VoiceLevel } from "./tile";

type DocumentPictureInPicture = {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
};

const documentPip = (): DocumentPictureInPicture | undefined =>
  (globalThis as { documentPictureInPicture?: DocumentPictureInPicture })
    .documentPictureInPicture;

const noSubscribe = () => () => {};

/** The page's styles, copied into the picture-in-picture window so it looks the same. */
function copyStyles(into: Window) {
  for (const sheet of [...document.styleSheets]) {
    try {
      const style = into.document.createElement("style");
      style.textContent = [...sheet.cssRules]
        .map((rule) => rule.cssText)
        .join("\n");
      into.document.head.append(style);
    } catch {
      // A sheet from another origin can't be read; link to it instead.
      if (!sheet.href) continue;
      const link = into.document.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      into.document.head.append(link);
    }
  }
  into.document.documentElement.className = `${document.documentElement.className} dark`;
  into.document.body.className =
    "bg-background text-foreground m-0 h-screen overflow-hidden font-sans";
}

/**
 * A small window that stays on top while you work in other tabs and apps, as in Meet:
 * Chrome's Document Picture-in-Picture. Null where the browser has none.
 */
export function usePictureInPicture() {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => documentPip() !== undefined,
    () => false,
  );
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  /** Opens it; the browser allows that only right after a click or a key. */
  const open = useCallback(async (): Promise<boolean> => {
    const api = documentPip();
    if (!api) return false;
    try {
      const opened = await api.requestWindow({ width: 360, height: 300 });
      copyStyles(opened);
      opened.addEventListener("pagehide", () => setPipWindow(null), {
        once: true,
      });
      setPipWindow(opened);
      return true;
    } catch {
      return false;
    }
  }, []);

  const close = useCallback(() => pipWindow?.close(), [pipWindow]);

  // Leaving the meeting closes it.
  useEffect(() => () => pipWindow?.close(), [pipWindow]);

  return { supported, pipWindow, open, close };
}

/** Who the small window shows: a shared screen, else whoever's talking, else someone. */
function mainOf(
  participants: RoomParticipant[],
  dominantKey: string | undefined,
): { participant: RoomParticipant; kind: "video" | "screen" } | null {
  const presenter = participants.find((p) => p.screen && !p.isLocal);
  if (presenter) return { participant: presenter, kind: "screen" };
  const others = participants.filter((p) => !p.isLocal);
  const speaker =
    others.find((p) => p.key === dominantKey) ??
    others.find((p) => p.speaking) ??
    others[0] ??
    participants[0];
  return speaker ? { participant: speaker, kind: "video" } : null;
}

const control =
  "flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white";

/**
 * The meeting in the small window: the shared screen or whoever's talking, and Mute,
 * Video, Raise hand and Leave. Plain buttons: menus from the page can't open in it.
 */
function MiniRoom({
  onToggleMic,
  handRaised,
  onToggleHand,
}: {
  onToggleMic: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
}) {
  const t = useTranslations("Meeting");
  const media = useRoomMedia();
  const main = mainOf(media.participants, media.dominantSpeakerKey);
  const sharingOwn = media.screenShare.enabled;

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="bg-card relative min-h-0 flex-1 overflow-hidden rounded-xl">
        {main ? (
          <>
            {main.kind === "screen" || main.participant.video ? (
              <TrackView
                participant={main.participant}
                kind={main.kind}
                className={cn(
                  "absolute inset-0 size-full",
                  main.kind === "screen" ? "object-contain" : "object-cover",
                )}
              />
            ) : main.participant.image ? (
              <span className="absolute inset-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={main.participant.image}
                  alt=""
                  className="size-20 rounded-full"
                />
              </span>
            ) : null}
            <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-xs font-medium text-white">
              {main.kind === "screen" ? null : (
                <VoiceLevel participant={main.participant} />
              )}
              <span className="truncate">
                {main.kind === "screen"
                  ? t("screenOf", { name: main.participant.name })
                  : main.participant.isLocal
                    ? t("you", { name: main.participant.name })
                    : main.participant.name}
              </span>
            </span>
          </>
        ) : null}
        {sharingOwn ? (
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-xs font-medium text-white">
            <MonitorUp className="size-3.5" aria-hidden="true" />
            {t("youAreSharing")}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2">
        <button
          type="button"
          aria-label={media.mic.enabled ? t("mute") : t("unmute")}
          title={media.mic.enabled ? t("mute") : t("unmute")}
          onClick={onToggleMic}
          className={cn(
            control,
            media.mic.enabled
              ? "bg-white/10 hover:bg-white/15"
              : "bg-destructive text-white",
          )}
        >
          {media.mic.enabled ? (
            <Mic className="size-5" aria-hidden="true" />
          ) : (
            <MicOff className="size-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label={media.camera.enabled ? t("stopVideo") : t("startVideo")}
          title={media.camera.enabled ? t("stopVideo") : t("startVideo")}
          onClick={() => void media.camera.toggle()}
          className={cn(
            control,
            media.camera.enabled
              ? "bg-white/10 hover:bg-white/15"
              : "bg-destructive text-white",
          )}
        >
          {media.camera.enabled ? (
            <Video className="size-5" aria-hidden="true" />
          ) : (
            <VideoOff className="size-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label={handRaised ? t("hand.lower") : t("hand.raise")}
          title={handRaised ? t("hand.lower") : t("hand.raise")}
          aria-pressed={handRaised}
          onClick={onToggleHand}
          className={cn(
            control,
            handRaised
              ? "bg-[#f2b200] text-[#1b1500]"
              : "bg-white/10 hover:bg-white/15",
          )}
        >
          <Hand className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t("leave")}
          title={t("leave")}
          onClick={() => void media.leave()}
          className={cn(control, "bg-destructive w-14 text-white")}
        >
          <PhoneOff className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** The small window's content, drawn into it while it's open. */
export function PictureInPicture({
  pipWindow,
  ...room
}: {
  pipWindow: Window | null;
  onToggleMic: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
}) {
  if (!pipWindow) return null;
  return createPortal(<MiniRoom {...room} />, pipWindow.document.body);
}
