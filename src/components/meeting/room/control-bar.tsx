"use client";

import { cn } from "cn";
import {
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Users,
  Video,
  VideoOff,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "react-aria-components";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { canShareScreen } from "@/lib/platform";

import { useRoomMedia } from "../media";
import { DeviceMenu } from "./device-menu";
import { shortcutLabel } from "./use-meeting-shortcuts";

/** A round control with its label underneath (hidden on phones) and a tooltip. */
function Control({
  icon: Icon,
  label,
  shortcut,
  danger = false,
  onPress,
  children,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  /** Red, as for a muted mic or a stopped camera. */
  danger?: boolean;
  onPress: () => void;
  /** Extra controls positioned over this one (the device caret). */
  children?: ReactNode;
}) {
  return (
    <div className="relative flex">
      <TooltipTrigger delay={500}>
        <Button
          aria-label={label}
          onPress={onPress}
          className="group flex flex-col items-center gap-1.5 rounded-xl px-0.5 py-1 outline-none md:w-[88px]"
        >
          <span
            className={cn(
              "group-focus-visible:ring-ring flex size-14 items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 md:size-11",
              danger
                ? "bg-destructive group-hover:bg-destructive/90 text-white"
                : "text-foreground bg-white/10 group-hover:bg-white/15",
            )}
          >
            <Icon className="size-6 md:size-[22px]" aria-hidden="true" />
          </span>
          <span className="text-foreground/80 max-w-[86px] text-center text-xs leading-[15px] max-md:hidden">
            {label}
          </span>
        </Button>
        <Tooltip>
          {label}
          {shortcut ? (
            <kbd className="font-sans opacity-70">({shortcut})</kbd>
          ) : null}
        </Tooltip>
      </TooltipTrigger>
      {children}
    </div>
  );
}

function TimeOfDay() {
  const locale = useLocale();
  const now = useNow(60_000);
  if (now === null) return null;
  return (
    <span className="text-foreground font-mono tabular-nums">
      {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(now)}
    </span>
  );
}

/** Leave, in red. Hosts get a choice: Leave meeting, or End meeting for all. */
function LeaveControl({
  isHost,
  onEndForAll,
}: {
  isHost: boolean;
  onEndForAll: () => void;
}) {
  const t = useTranslations("Meeting");
  const media = useRoomMedia();
  const pill = (
    <Button
      onPress={isHost ? undefined : () => void media.leave()}
      aria-label={t("leave")}
      className="bg-destructive hover:bg-destructive/90 focus-visible:ring-ring flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-semibold whitespace-nowrap text-white outline-none focus-visible:ring-2 max-md:w-14 max-md:justify-center max-md:px-0 md:h-11"
    >
      <PhoneOff className="size-5" aria-hidden="true" />
      <span className="max-md:hidden">{t("leave")}</span>
    </Button>
  );

  return (
    <div className="flex pt-1 md:pl-2.5">
      {isHost ? (
        <DropdownMenuTrigger>
          {pill}
          <DropdownMenu placement="top end" className="min-w-56">
            <DropdownMenuItem onAction={() => void media.leave()}>
              {t("leaveMeeting")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onAction={onEndForAll}>
              {t("endForAll")}
            </DropdownMenuItem>
          </DropdownMenu>
        </DropdownMenuTrigger>
      ) : (
        pill
      )}
    </div>
  );
}

/**
 * The bottom bar, in Zoom's and Meet's order: mic and camera first (each with a device
 * caret), then Share screen, then the red Leave. Phones get the same buttons, larger,
 * without labels.
 */
export function ControlBar({
  title,
  isHost,
  onEndForAll,
}: {
  title: string;
  isHost: boolean;
  onEndForAll: () => void;
}) {
  const t = useTranslations("Meeting");
  const media = useRoomMedia();
  const { mic, camera, speaker, screenShare } = media;
  const count = media.participants.length;

  return (
    <footer className="flex shrink-0 items-start justify-center gap-4 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:justify-between md:px-5">
      <div className="text-muted-foreground flex min-w-0 flex-1 items-center gap-2.5 pt-[18px] text-sm max-md:hidden">
        <TimeOfDay />
        <span aria-hidden="true">·</span>
        <span className="truncate">{title}</span>
      </div>

      <div className="flex items-start gap-2 md:gap-0.5">
        <Control
          icon={mic.enabled ? Mic : MicOff}
          label={mic.enabled ? t("mute") : t("unmute")}
          shortcut={shortcutLabel("D")}
          danger={!mic.enabled}
          onPress={() => void mic.toggle()}
        >
          <DeviceMenu
            label={t("audioSettings")}
            sections={[
              {
                title: t("microphone"),
                devices: mic.devices,
                selectedId: mic.selectedId,
                onSelect: (id) => void mic.select(id),
              },
              ...(speaker.supported
                ? [
                    {
                      title: t("speaker"),
                      devices: speaker.devices,
                      selectedId: speaker.selectedId,
                      onSelect: speaker.select,
                    },
                  ]
                : []),
            ]}
          />
        </Control>
        <Control
          icon={camera.enabled ? Video : VideoOff}
          label={camera.enabled ? t("stopVideo") : t("startVideo")}
          shortcut={shortcutLabel("E")}
          danger={!camera.enabled}
          onPress={() => void camera.toggle()}
        >
          <DeviceMenu
            label={t("videoSettings")}
            sections={[
              {
                title: t("camera"),
                devices: camera.devices,
                selectedId: camera.selectedId,
                onSelect: (id) => void camera.select(id),
              },
            ]}
          />
        </Control>
        {canShareScreen() ? (
          <Control
            icon={screenShare.enabled ? MonitorX : MonitorUp}
            label={screenShare.enabled ? t("stopSharing") : t("shareScreen")}
            danger={screenShare.enabled}
            onPress={() => void screenShare.toggle()}
          />
        ) : null}
        <LeaveControl isHost={isHost} onEndForAll={onEndForAll} />
      </div>

      <div className="text-foreground/80 flex flex-1 justify-end gap-2 pt-[18px] text-sm max-md:hidden">
        <Users className="size-5" aria-hidden="true" />
        <span aria-hidden="true">{count}</span>
        <span className="sr-only">{t("participantCount", { count })}</span>
      </div>
    </footer>
  );
}
