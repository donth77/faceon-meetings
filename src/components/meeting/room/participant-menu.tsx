"use client";

import { cn } from "cn";
import {
  Crown,
  Ellipsis,
  Mic,
  MicOff,
  MonitorX,
  Pin,
  PinOff,
  Star,
  StarOff,
  UserX,
  VideoOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { Button } from "react-aria-components";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModerateRequest } from "@/lib/meetings/api";

import type { RoomParticipant } from "../media";
import { moderates } from "./roles";
import { useRoomControls } from "./room-controls";

/**
 * The ⋯ menu for one person, on their tile and in Participants: Pin for yourself, and
 * for hosts and co-hosts Spotlight, Mute or Ask to unmute, Stop video, Stop sharing,
 * co-host and Remove. The server checks every action again.
 */
export function ParticipantMenu({
  participant,
  className,
}: {
  participant: RoomParticipant;
  className?: string;
}) {
  const t = useTranslations("Meeting.moderation");
  const controls = useRoomControls();
  const isSelf = participant.userId === controls.selfId;
  const theirRole = controls.roleOf(participant.userId);
  const canModerate = moderates(controls.selfRole);
  const pinned = controls.pinnedKey === participant.key;
  const spotlighted = controls.spotlight === participant.userId;
  const run = (request: ModerateRequest) => void controls.moderate(request);
  const target = participant.userId;

  const items: ReactElement[] = [
    <DropdownMenuItem
      key="pin"
      onAction={() => controls.togglePin(participant.key)}
    >
      {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
      {pinned ? t("unpin") : t("pin")}
    </DropdownMenuItem>,
  ];
  if (canModerate) {
    items.push(
      <DropdownMenuItem
        key="spotlight"
        onAction={() =>
          run({ action: "spotlight", target: spotlighted ? null : target })
        }
      >
        {spotlighted ? (
          <StarOff aria-hidden="true" />
        ) : (
          <Star aria-hidden="true" />
        )}
        {spotlighted ? t("endSpotlight") : t("spotlight")}
      </DropdownMenuItem>,
    );
  }
  if (canModerate && !isSelf) {
    items.push(
      participant.audio ? (
        <DropdownMenuItem
          key="mute"
          onAction={() => run({ action: "mute", target, kind: "audio" })}
        >
          <MicOff aria-hidden="true" />
          {t("mute")}
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          key="unmute"
          onAction={() => run({ action: "askToUnmute", target })}
        >
          <Mic aria-hidden="true" />
          {t("askToUnmute")}
        </DropdownMenuItem>
      ),
    );
    if (participant.video) {
      items.push(
        <DropdownMenuItem
          key="video"
          onAction={() => run({ action: "mute", target, kind: "video" })}
        >
          <VideoOff aria-hidden="true" />
          {t("stopVideo")}
        </DropdownMenuItem>,
      );
    }
    if (participant.screen) {
      items.push(
        <DropdownMenuItem
          key="share"
          onAction={() => run({ action: "mute", target, kind: "screenshare" })}
        >
          <MonitorX aria-hidden="true" />
          {t("stopSharing")}
        </DropdownMenuItem>,
      );
    }
  }
  if (controls.selfRole === "host" && !isSelf && theirRole !== "host") {
    items.push(
      theirRole === "cohost" ? (
        <DropdownMenuItem
          key="cohost"
          onAction={() => run({ action: "removeCohost", target })}
        >
          <Crown aria-hidden="true" />
          {t("removeCohost")}
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          key="cohost"
          onAction={() => run({ action: "makeCohost", target })}
        >
          <Crown aria-hidden="true" />
          {t("makeCohost")}
        </DropdownMenuItem>
      ),
    );
  }
  const canRemove =
    canModerate &&
    !isSelf &&
    theirRole !== "host" &&
    (controls.selfRole === "host" || theirRole !== "cohost");
  if (canRemove) {
    items.push(
      <DropdownMenuSeparator key="separator" />,
      <DropdownMenuItem
        key="remove"
        variant="destructive"
        onAction={() => controls.confirmRemove(participant)}
      >
        <UserX aria-hidden="true" />
        {t("remove")}
      </DropdownMenuItem>,
    );
  }

  return (
    <DropdownMenuTrigger>
      <Button
        aria-label={t("optionsFor", { name: participant.name })}
        className={cn(
          "focus-visible:ring-ring flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2",
          className,
        )}
      >
        <Ellipsis className="size-[18px]" aria-hidden="true" />
      </Button>
      <DropdownMenu placement="bottom end" className="min-w-56">
        {items}
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
