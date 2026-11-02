"use client";

import { cn } from "cn";
import {
  Ellipsis,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  ShieldUser,
  SmilePlus,
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
  DropdownMenuSub,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { REACTIONS, type ReactionCode } from "@/lib/meetings/events";
import { canShareScreen } from "@/lib/platform";

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
  const locale = useLocale();
  const now = useNow(60_000);
  if (now === null) return null;
  return (
    <span className="text-foreground font-mono tabular-nums">
      {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(now)}
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
      className="bg-destructive hover:bg-destructive/90 focus-visible:ring-ring flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-semibold whitespace-nowrap text-white outline-none focus-visible:ring-2 max-md:w-14 max-md:justify-center max-md:px-0 md:h-11"
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

/**
 * The bottom bar, in Zoom's and Meet's order: mic and camera first (each with a device
 * caret), then Share screen, then the red Leave. Phones get the same buttons, larger,
 * without labels.
 */
export type PanelName = "people" | "chat" | "host";

/** Participants or Chat: a round button with a count badge, tinted while its panel is open. */
function PanelButton({
  icon: Icon,
  label,
  accessibleLabel,
  badge,
  badgeTone = "neutral",
  active,
  onPress,
}: {
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
      onPress={onPress}
      className="group flex w-24 flex-col items-center gap-1.5 rounded-xl px-0.5 py-1 outline-none"
    >
      <span
        className={cn(
          "group-focus-visible:ring-ring relative flex size-11 items-center justify-center rounded-full transition-colors group-focus-visible:ring-2",
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

/** On phones, Participants, Chat and Host controls live in the More menu. */
function MoreMenu({
  peopleCount,
  unreadChat,
  isHost,
  onOpenPanel,
  onReaction,
}: {
  peopleCount: number;
  unreadChat: number;
  isHost: boolean;
  onOpenPanel: (panel: PanelName) => void;
  /** Null when the host has turned reactions off. */
  onReaction: ((code: ReactionCode) => void) | null;
}) {
  const t = useTranslations("Meeting");
  return (
    <div className="flex md:hidden">
      <DropdownMenuTrigger>
        <Button
          aria-label={t("more")}
          className="text-foreground focus-visible:ring-ring relative flex size-14 items-center justify-center rounded-full bg-white/10 outline-none hover:bg-white/15 focus-visible:ring-2"
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
          {isHost ? (
            <DropdownMenuItem onAction={() => onOpenPanel("host")}>
              <ShieldUser aria-hidden="true" />
              {t("hostControls.title")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenu>
      </DropdownMenuTrigger>
    </div>
  );
}

export function ControlBar({
  title,
  isOwner,
  isHost,
  onEndForAll,
  panel,
  onTogglePanel,
  unreadChat,
  onToggleMic,
  share,
  handRaised,
  onToggleHand,
  onReaction,
}: {
  title: string;
  /** The meeting's owner, who can end it for everyone. */
  isOwner: boolean;
  /** The owner or a co-host, who get Host controls. */
  isHost: boolean;
  onEndForAll: () => void;
  /** The side panel that's open, if any. */
  panel: PanelName | null;
  onTogglePanel: (panel: PanelName) => void;
  unreadChat: number;
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
          tone={mic.enabled ? "plain" : "danger"}
          onPress={onToggleMic}
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
          tone={camera.enabled ? "plain" : "danger"}
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
        <MoreMenu
          peopleCount={count}
          unreadChat={unreadChat}
          isHost={isHost}
          onOpenPanel={onTogglePanel}
          onReaction={onReaction}
        />
        <LeaveControl isOwner={isOwner} onEndForAll={onEndForAll} />
      </div>

      <div className="flex flex-1 items-start justify-end gap-0.5 max-md:hidden">
        {isHost ? (
          <PanelButton
            icon={ShieldUser}
            label={t("hostControls.button")}
            accessibleLabel={t("hostControls.title")}
            badge={null}
            active={panel === "host"}
            onPress={() => onTogglePanel("host")}
          />
        ) : null}
        <PanelButton
          icon={Users}
          label={t("people.button")}
          accessibleLabel={t("participantCount", { count })}
          badge={count}
          active={panel === "people"}
          onPress={() => onTogglePanel("people")}
        />
        <PanelButton
          icon={MessageSquare}
          label={t("chat.title")}
          accessibleLabel={
            unreadChat > 0
              ? t("chat.withUnread", { count: unreadChat })
              : t("chat.title")
          }
          badge={unreadChat > 0 ? unreadChat : null}
          badgeTone="brand"
          active={panel === "chat"}
          onPress={() => onTogglePanel("chat")}
        />
      </div>
    </footer>
  );
}
