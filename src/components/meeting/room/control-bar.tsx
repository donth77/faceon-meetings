"use client";

import { cn } from "cn";
import {
  Ellipsis,
  Hand,
  Keyboard,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  PhoneOff,
  PictureInPicture2,
  Settings,
  SmilePlus,
  Sparkles,
  Users,
  Video,
  VideoOff,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, type ReactNode } from "react";
import { Button } from "react-aria-components";

import { useOpenShortcuts } from "@/components/shortcuts/shortcuts-dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useCapability } from "@/hooks/use-capability";
import { useNow } from "@/hooks/use-now";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { REACTIONS, type ReactionCode } from "@/lib/meetings/events";
import { useIntlLocale } from "@/lib/preferences";

import { useRoomMedia, type ShareOptions } from "../media";
import { ControlButton } from "./control-button";
import { DeviceMenu } from "./device-menu";
import { EMOJI_FONT, ReactionsControl } from "./reactions";
import { ShareControl } from "./share-control";
import { shortcutLabel } from "./use-meeting-shortcuts";

/** A round control with a tooltip that names its keyboard shortcut. */
function Control({
  shortcut,
  children,
  ...button
}: Parameters<typeof ControlButton>[0] & {
  shortcut?: string;
  /** Extra controls positioned over this one (the device caret). */
  children?: ReactNode;
}) {
  return (
    <div className="relative flex">
      <TooltipTrigger delay={500}>
        <ControlButton {...button} />
        <Tooltip>
          {button.label}
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
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const now = useNow(60_000);
  if (now === null) return null;
  return (
    <span className="text-foreground font-mono tabular-nums">
      {new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).format(
        now,
      )}
    </span>
  );
}

/** Leave, in red. The host gets a choice: Leave meeting, or End meeting for all. */
function LeaveControl({
  isOwner,
  onEndForAll,
}: {
  isOwner: boolean;
  onEndForAll: () => void;
}) {
  const t = useTranslations("Meeting");
  const media = useRoomMedia();
  const pill = (
    <Button
      onPress={isOwner ? undefined : () => void media.leave()}
      aria-label={t("leave")}
      className="bg-destructive-fill hover:bg-destructive-fill/90 focus-visible:focus-ring flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-semibold whitespace-nowrap text-white outline-hidden max-[400px]:size-11 max-md:w-14 max-md:justify-center max-md:px-0 md:h-11"
    >
      <PhoneOff className="size-5" aria-hidden="true" />
      <span className="max-md:hidden">{t("leave")}</span>
    </Button>
  );

  return (
    <div className="flex pt-1 md:pl-2.5">
      {isOwner ? (
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

/** The side panels: Participants, Chat, AI notes, and Backgrounds and effects. */
export type PanelName = "people" | "chat" | "notes" | "effects";

/** Participants or Chat: a round button with a count badge, tinted while its panel is open. */
function PanelButton({
  panel,
  icon: Icon,
  label,
  accessibleLabel,
  badge,
  badgeTone = "neutral",
  active,
  onPress,
}: {
  panel: PanelName;
  icon: LucideIcon;
  label: string;
  accessibleLabel: string;
  badge: number | null;
  badgeTone?: "neutral" | "brand";
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      aria-label={accessibleLabel}
      aria-pressed={active}
      data-panel-toggle={panel}
      onPress={onPress}
      className="group flex w-24 flex-col items-center gap-1.5 rounded-xl px-0.5 py-1 outline-none"
    >
      <span
        className={cn(
          "group-focus-visible:focus-ring relative flex size-11 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-secondary text-primary"
            : "text-foreground bg-white/10 group-hover:bg-white/15",
        )}
      >
        <Icon className="size-[22px]" aria-hidden="true" />
        {badge !== null ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -top-1 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
              badgeTone === "brand"
                ? "bg-primary text-primary-foreground"
                : "text-foreground bg-[#3a424d]",
            )}
          >
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-foreground/80 max-w-[94px] text-center text-xs leading-[15px]">
        {label}
      </span>
    </Button>
  );
}

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Whether the meeting fills the screen, and a way to switch; null where it can't. */
function useFullscreen() {
  const active = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );
  const supported = useCapability("fullscreen");
  if (!supported) return null;
  return {
    active,
    toggle: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => {});
    },
  };
}

/**
 * AI notes (for hosts), Settings, full screen, picture-in-picture and the shortcuts, in
 * both More menus: each only where this browser and device have it.
 */
function MoreItems({
  onOpenSettings,
  onOpenPictureInPicture,
  onOpenNotes,
}: {
  onOpenSettings: () => void;
  onOpenPictureInPicture?: (() => void) | undefined;
  /** For hosts and co-hosts. */
  onOpenNotes?: (() => void) | undefined;
}) {
  const t = useTranslations("Meeting");
  const keyboard = useCapability("keyboard");
  const openShortcuts = useOpenShortcuts();
  const fullscreen = useFullscreen();
  return (
    <>
      {onOpenNotes ? (
        <DropdownMenuItem onAction={onOpenNotes}>
          <Sparkles aria-hidden="true" />
          {t("notes.title")}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onAction={onOpenSettings}>
        <Settings aria-hidden="true" />
        {t("settings")}
      </DropdownMenuItem>
      {fullscreen ? (
        <DropdownMenuItem onAction={fullscreen.toggle}>
          {fullscreen.active ? (
            <Minimize aria-hidden="true" />
          ) : (
            <Maximize aria-hidden="true" />
          )}
          {fullscreen.active ? t("exitFullScreen") : t("fullScreen")}
        </DropdownMenuItem>
      ) : null}
      {onOpenPictureInPicture ? (
        <DropdownMenuItem onAction={onOpenPictureInPicture}>
          <PictureInPicture2 aria-hidden="true" />
          {t("openPictureInPicture")}
        </DropdownMenuItem>
      ) : null}
      {keyboard ? (
        <DropdownMenuItem onAction={openShortcuts}>
          <Keyboard aria-hidden="true" />
          {t("keyboardShortcuts")}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

/** More, beside Raise hand on desktop: Settings, full screen and the shortcuts. */
function DesktopMoreMenu({
  onOpenSettings,
  onOpenPictureInPicture,
  onOpenNotes,
}: {
  onOpenSettings: () => void;
  onOpenPictureInPicture?: (() => void) | undefined;
  onOpenNotes?: (() => void) | undefined;
}) {
  const t = useTranslations("Meeting");
  return (
    <div className="flex max-md:hidden">
      <DropdownMenuTrigger>
        <ControlButton icon={Ellipsis} label={t("more")} data-more-menu />
        <DropdownMenu placement="top" className="min-w-56">
          <MoreItems
            onOpenSettings={onOpenSettings}
            onOpenPictureInPicture={onOpenPictureInPicture}
            onOpenNotes={onOpenNotes}
          />
        </DropdownMenu>
      </DropdownMenuTrigger>
    </div>
  );
}

/** On phones, Participants, Chat and Settings live in the More menu. */
function MoreMenu({
  peopleCount,
  unreadChat,
  onOpenPanel,
  onReaction,
  onOpenSettings,
  onOpenNotes,
  onOpenEffects,
}: {
  peopleCount: number;
  unreadChat: number;
  onOpenPanel: (panel: PanelName) => void;
  /** Null when the host has turned reactions off. */
  onReaction: ((code: ReactionCode) => void) | null;
  onOpenSettings: () => void;
  onOpenNotes?: (() => void) | undefined;
  /** Phones have no camera caret, so Backgrounds and effects is here. */
  onOpenEffects?: (() => void) | undefined;
}) {
  const t = useTranslations("Meeting");
  const te = useTranslations("Effects");
  return (
    <div className="flex md:hidden">
      <DropdownMenuTrigger>
        <Button
          aria-label={
            unreadChat > 0
              ? t("moreWithUnread", { count: unreadChat })
              : t("more")
          }
          data-more-menu
          className="text-foreground focus-visible:focus-ring relative flex size-14 items-center justify-center rounded-full bg-white/10 outline-hidden hover:bg-white/15 max-[400px]:size-11"
        >
          <Ellipsis className="size-6" aria-hidden="true" />
          {unreadChat > 0 ? (
            <span
              aria-hidden="true"
              className="bg-primary absolute top-1 right-1 size-2.5 rounded-full"
            />
          ) : null}
        </Button>
        <DropdownMenu placement="top end" className="min-w-56">
          {onReaction ? (
            <DropdownMenuSub>
              <DropdownMenuItem>
                <SmilePlus aria-hidden="true" />
                {t("reactions.send")}
              </DropdownMenuItem>
              <DropdownMenu placement="top end" className="min-w-44">
                {REACTIONS.map((reaction) => (
                  <DropdownMenuItem
                    key={reaction.code}
                    textValue={t(`reactions.names.${reaction.name}`)}
                    onAction={() => onReaction(reaction.code)}
                  >
                    <span
                      aria-hidden="true"
                      className={`${EMOJI_FONT} text-xl`}
                    >
                      {reaction.emoji}
                    </span>
                    {t(`reactions.names.${reaction.name}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenu>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuItem onAction={() => onOpenPanel("people")}>
            <Users aria-hidden="true" />
            {t("people.withCount", { count: peopleCount })}
          </DropdownMenuItem>
          <DropdownMenuItem onAction={() => onOpenPanel("chat")}>
            <MessageSquare aria-hidden="true" />
            {unreadChat > 0
              ? t("chat.withUnread", { count: unreadChat })
              : t("chat.title")}
          </DropdownMenuItem>
          {onOpenEffects ? (
            <DropdownMenuItem onAction={onOpenEffects}>
              <WandSparkles aria-hidden="true" />
              {te("title")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <MoreItems
            onOpenSettings={onOpenSettings}
            onOpenNotes={onOpenNotes}
          />
        </DropdownMenu>
      </DropdownMenuTrigger>
    </div>
  );
}

/**
 * The bottom bar, in Zoom's and Meet's order: mic and camera first (each with a device
 * caret), then Share screen, then the red Leave. Phones get the same buttons, larger,
 * without labels; narrow ones, a little smaller, wrapping rather than cutting any off.
 */
export function ControlBar({
  title,
  isOwner,
  onEndForAll,
  panels,
  onTogglePanel,
  onOpenSettings,
  onOpenPictureInPicture,
  onOpenNotes,
  onOpenEffects,
  unreadChat,
  waitingCount,
  onToggleMic,
  share,
  handRaised,
  onToggleHand,
  onReaction,
  inert,
}: {
  title: string;
  /** The meeting's owner, who can end it for everyone. */
  isOwner: boolean;
  onEndForAll: () => void;
  /** The side panels that are open. */
  panels: PanelName[];
  onTogglePanel: (panel: PanelName) => void;
  /** Opens Settings on a section. */
  onOpenSettings: (section?: "audio" | "video") => void;
  /** Opens the meeting in a small window; absent where the browser can't. */
  onOpenPictureInPicture?: (() => void) | undefined;
  /** Opens AI notes; for hosts and co-hosts. */
  onOpenNotes?: (() => void) | undefined;
  /** Opens Backgrounds and effects; absent where the browser can't run them. */
  onOpenEffects?: (() => void) | undefined;
  unreadChat: number;
  /** People in the waiting room (hosts and co-hosts see them). */
  waitingCount: number;
  onToggleMic: () => void;
  share: {
    /** Says why you can't share right now; null when you can. */
    onBlocked: (() => void) | null;
    onStart: (options: ShareOptions) => void;
    onStop: () => void;
  };
  handRaised: boolean;
  onToggleHand: () => void;
  /** Null when the host has turned reactions off. */
  onReaction: ((code: ReactionCode) => void) | null;
  /** Out of reach while a sheet covers the room (phones). */
  inert?: boolean;
}) {
  const t = useTranslations("Meeting");
  const te = useTranslations("Effects");
  const tk = useTranslations("Shortcuts.keys");
  const media = useRoomMedia();
  const { mic, camera, speaker, screenShare } = media;
  const count = media.participants.length;
  const canShare = useCapability("screenShare");

  return (
    <footer
      inert={inert}
      className="flex shrink-0 items-start justify-center gap-4 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:justify-between md:px-5"
    >
      <div className="text-muted-foreground flex min-w-0 flex-1 items-center gap-2.5 pt-[18px] text-sm max-md:hidden">
        <TimeOfDay />
        <span aria-hidden="true">·</span>
        <span className="truncate">{title}</span>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-2 max-[400px]:gap-1 md:flex-nowrap md:gap-0.5">
        <Control
          icon={mic.enabled ? Mic : MicOff}
          label={mic.enabled ? t("mute") : t("unmute")}
          shortcut={shortcutLabel("D", tk("ctrl"))}
          tone={mic.enabled ? "plain" : "danger"}
          onPress={onToggleMic}
        >
          <DeviceMenu
            label={t("audioSettings")}
            settingsLabel={t("audioSettingsMore")}
            onOpenSettings={() => onOpenSettings("audio")}
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
          shortcut={shortcutLabel("E", tk("ctrl"))}
          tone={camera.enabled ? "plain" : "danger"}
          onPress={() => void camera.toggle()}
        >
          <DeviceMenu
            label={t("videoSettings")}
            panelToggle={onOpenEffects ? "effects" : undefined}
            settingsLabel={t("videoSettingsMore")}
            onOpenSettings={() => onOpenSettings("video")}
            extra={
              onOpenEffects
                ? {
                    label: te("open"),
                    icon: WandSparkles,
                    onAction: onOpenEffects,
                  }
                : undefined
            }
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
        {canShare ? (
          <ShareControl sharing={screenShare.enabled} {...share} />
        ) : null}
        {onReaction ? (
          <div className="flex max-md:hidden">
            <ReactionsControl onSend={onReaction} />
          </div>
        ) : null}
        <Control
          icon={Hand}
          label={handRaised ? t("hand.lower") : t("hand.raise")}
          tone={handRaised ? "amber" : "plain"}
          onPress={onToggleHand}
        />
        <DesktopMoreMenu
          onOpenSettings={() => onOpenSettings()}
          onOpenPictureInPicture={onOpenPictureInPicture}
          onOpenNotes={onOpenNotes}
        />
        <MoreMenu
          peopleCount={count}
          unreadChat={unreadChat}
          onOpenPanel={onTogglePanel}
          onReaction={onReaction}
          onOpenSettings={() => onOpenSettings()}
          onOpenNotes={onOpenNotes}
          onOpenEffects={onOpenEffects}
        />
        <LeaveControl isOwner={isOwner} onEndForAll={onEndForAll} />
      </div>

      <div className="flex flex-1 items-start justify-end gap-0.5 max-md:hidden">
        <PanelButton
          panel="people"
          icon={Users}
          label={t("people.button")}
          accessibleLabel={
            waitingCount > 0
              ? t("lobby.participantsWaiting", { count, waiting: waitingCount })
              : t("participantCount", { count })
          }
          badge={waitingCount > 0 ? waitingCount : count}
          badgeTone={waitingCount > 0 ? "brand" : "neutral"}
          active={panels.includes("people")}
          onPress={() => onTogglePanel("people")}
        />
        <PanelButton
          panel="chat"
          icon={MessageSquare}
          label={t("chat.title")}
          accessibleLabel={
            unreadChat > 0
              ? t("chat.withUnread", { count: unreadChat })
              : t("chat.title")
          }
          badge={unreadChat > 0 ? unreadChat : null}
          badgeTone="brand"
          active={panels.includes("chat")}
          onPress={() => onTogglePanel("chat")}
        />
      </div>
    </footer>
  );
}
