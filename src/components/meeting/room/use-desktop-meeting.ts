"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";

import { useDesktop } from "@/lib/desktop/use-desktop";

/**
 * The desktop app's side of a meeting: it knows you're in one and whether you're muted
 * (for its tray and the mute shortcut that works from any app), shows unread chat on the
 * dock or taskbar, and its Mute and Leave go through the room's own controls, push to
 * talk and hosts' rules included. A link opened from outside during a meeting asks first.
 */
export function useDesktopMeeting({
  muted,
  title,
  unread,
  onToggleMute,
  onLeave,
}: {
  muted: boolean;
  title: string;
  unread: number;
  onToggleMute: () => void;
  onLeave: () => Promise<void>;
}) {
  const t = useTranslations("Meeting.desktop");
  const desktop = useDesktop();

  useEffect(() => {
    desktop?.meeting({ inMeeting: true, muted, title: title.slice(0, 200) });
  }, [desktop, muted, title]);
  useEffect(
    () => () => desktop?.meeting({ inMeeting: false, muted: false }),
    [desktop],
  );
  useEffect(() => {
    desktop?.setUnread(unread);
  }, [desktop, unread]);
  useEffect(() => () => desktop?.setUnread(0), [desktop]);

  const toggleMute = useEffectEvent(onToggleMute);
  const leave = useEffectEvent(onLeave);
  const openLink = useEffectEvent((path: string) => {
    toast(t("openLink"), {
      id: "desktop-link",
      duration: 15_000,
      action: {
        label: t("leaveAndOpen"),
        onClick: () => void leave().finally(() => window.location.assign(path)),
      },
    });
  });
  useEffect(
    () =>
      desktop?.onCommand((command) => {
        if (command.type === "toggleMute") toggleMute();
        else if (command.type === "leave") void leave();
        else openLink(command.path);
      }),
    [desktop],
  );
}
