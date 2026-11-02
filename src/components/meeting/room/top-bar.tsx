"use client";

import { cn } from "cn";
import {
  ChevronDown,
  Clock3,
  Copy,
  LayoutGrid,
  Link2,
  Lock,
  ShieldCheck,
  SwitchCamera,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, Dialog, type Selection } from "react-aria-components";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import type { AdmittedMeetingInfo, SessionInfo } from "@/lib/meetings/api";
import { formatMeetingCode } from "@/lib/meetings/codes";

import { useInvitation } from "../invitation";
import { useRoomMedia } from "../media";
import type { LayoutChoice, StageView } from "./stage";

const LAYOUTS: LayoutChoice[] = ["auto", "gallery", "speaker", "spotlight"];
const HIDES = ["hideSelf", "hideNoVideo"] as const;

const iconButton =
  "flex size-9 items-center justify-center rounded-[10px] outline-hidden hover:bg-white/10 focus-visible:focus-ring";

function MeetingInfo({ meeting }: { meeting: AdmittedMeetingInfo }) {
  const t = useTranslations("Meeting");
  const { link, copyLink, copyInvitation } = useInvitation(meeting);

  return (
    <PopoverTrigger>
      <Button
        aria-label={t("meetingInfo")}
        className={`text-live ${iconButton}`}
      >
        <ShieldCheck className="size-[22px]" aria-hidden="true" />
      </Button>
      <Popover placement="bottom start" className="w-80">
        <Dialog aria-label={t("meetingInfo")} className="outline-none">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-1.5 text-sm">
            <dt className="text-muted-foreground">{t("hostLabel")}</dt>
            <dd className="truncate">{meeting.hostName}</dd>
            <dt className="text-muted-foreground">{t("meetingId")}</dt>
            <dd className="font-mono">{formatMeetingCode(meeting.code)}</dd>
            {meeting.passcode ? (
              <>
                <dt className="text-muted-foreground">{t("passcode")}</dt>
                <dd className="font-mono">{meeting.passcode}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">{t("inviteLink")}</dt>
            <dd className="text-muted-foreground truncate select-all">
              {link}
            </dd>
          </dl>
          <Button
            onPress={() => void copyLink()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:focus-ring mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold outline-hidden"
          >
            <Link2 className="size-4" aria-hidden="true" />
            {t("copyLink")}
          </Button>
          <Button
            onPress={() => void copyInvitation()}
            className="focus-visible:focus-ring mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-sm font-semibold outline-hidden hover:bg-white/15"
          >
            <Copy className="size-4" aria-hidden="true" />
            {t("copyInvitation")}
          </Button>
        </Dialog>
      </Popover>
    </PopoverTrigger>
  );
}

const twoDigits = (n: number) => String(n).padStart(2, "0");
/** Seconds as mm:ss, for countdowns. */
export const clock = (seconds: number) =>
  `${twoDigits(Math.floor(seconds / 60))}:${twoDigits(seconds % 60)}`;

/** Shows a time limit only in its last five minutes, unless it's a demo. */
const WARN_SECONDS = 5 * 60;

/** Whether the time-limit chip is showing (see TimeLimit). */
export const limitShown = (
  session: SessionInfo,
  endsAt: number | null,
  now: number | null,
) =>
  endsAt !== null &&
  now !== null &&
  (session.demo || endsAt - now <= WARN_SECONDS * 1000);

/** The minutes left at which everyone hears how long is left. */
const WARNINGS = [5, 1];

/**
 * The session's time limit: a "Demo" chip with a countdown for demo meetings, and a
 * countdown in the last five minutes of any other limited meeting.
 */
function TimeLimit({
  session,
  endsAt,
}: {
  session: SessionInfo;
  endsAt: number | null;
}) {
  const t = useTranslations("Meeting");
  const now = useNow(1000);
  const left =
    now === null || endsAt === null
      ? null
      : Math.max(0, Math.round((endsAt - now) / 1000));
  // The countdown is only seen; say it at five minutes and at one (4.1.3).
  const warned = useRef<number | null>(null);
  useEffect(() => {
    if (left === null) return;
    const due = WARNINGS.findLast((minutes) => left <= minutes * 60);
    if (due === undefined || left === 0 || due === warned.current) return;
    warned.current = due;
    toast(t("minutesLeft", { minutes: due }), { id: "time-limit" });
  }, [left, t]);
  if (left === null) return null;
  if (!session.demo && left > WARN_SECONDS) return null;
  const urgent = left <= WARN_SECONDS;

  return (
    <TooltipTrigger delay={300}>
      <Button
        className={`focus-visible:focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 font-mono text-sm whitespace-nowrap tabular-nums outline-hidden ${urgent ? "bg-amber-400/20 text-amber-100" : "bg-white/10"}`}
      >
        {session.demo ? (
          // Below 400 px only the countdown shows; "Demo" stays in its name.
          <span className="font-sans font-semibold max-[400px]:sr-only">
            {t("demo")} ·
          </span>
        ) : null}
        {t("timeLeft", { time: clock(left) })}
      </Button>
      <Tooltip>
        {session.demo
          ? t("demoExplained", {
              minutes: session.maxMinutes ?? 0,
              people: session.maxParticipants,
            })
          : t("timeLeft", { time: clock(left) })}
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * How long the meeting has been going, from the earliest join we can see. On a phone it
 * makes way while the time-limit chip shows.
 */
function Elapsed({
  session,
  endsAt,
}: {
  session: SessionInfo;
  endsAt: number | null;
}) {
  const t = useTranslations("Meeting");
  const media = useRoomMedia();
  const now = useNow(1000);
  const joins = media.participants
    .map((p) => p.joinedAt)
    .filter((at) => at > 0);
  if (now === null || joins.length === 0) return null;

  const total = Math.max(0, Math.floor((now - Math.min(...joins)) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  return (
    <span
      role="timer"
      aria-label={t("elapsed", { time })}
      className={cn(
        "text-foreground/85 flex items-center gap-1.5 font-mono text-sm tabular-nums",
        limitShown(session, endsAt, now) && "max-sm:hidden",
      )}
    >
      <Clock3 className="size-4" aria-hidden="true" />
      {time}
    </span>
  );
}

function LayoutMenu({
  view,
  onChange,
}: {
  view: StageView;
  onChange: (view: StageView) => void;
}) {
  const t = useTranslations("Meeting");

  function chooseLayout(keys: Selection) {
    const [next] = keys === "all" ? [] : [...keys];
    const layout = LAYOUTS.find((choice) => choice === next);
    if (layout) onChange({ ...view, layout });
  }

  function chooseHides(keys: Selection) {
    const on = keys === "all" ? new Set<string>(HIDES) : new Set(keys);
    onChange({
      ...view,
      hideSelf: on.has("hideSelf"),
      hideNoVideo: on.has("hideNoVideo"),
    });
  }

  return (
    <DropdownMenuTrigger>
      <Button
        aria-label={t("layoutLabel", { layout: t(`layouts.${view.layout}`) })}
        className="focus-visible:focus-ring flex h-9 items-center gap-2 rounded-[10px] bg-white/10 pr-2.5 pl-3 text-sm outline-hidden hover:bg-white/15 max-[400px]:w-9 max-[400px]:justify-center max-[400px]:px-0"
      >
        <LayoutGrid className="size-[18px]" aria-hidden="true" />
        <span className="max-sm:hidden">{t(`layouts.${view.layout}`)}</span>
        <ChevronDown className="size-4 max-[400px]:hidden" aria-hidden="true" />
      </Button>
      <DropdownMenu placement="bottom end" className="min-w-64">
        <DropdownMenuGroup
          aria-label={t("layout")}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[view.layout]}
          onSelectionChange={chooseLayout}
        >
          {LAYOUTS.map((layout) => (
            <DropdownMenuItem
              key={layout}
              id={layout}
              textValue={t(`layouts.${layout}`)}
              className="py-1.5"
            >
              <span className="flex flex-col">
                <span>{t(`layouts.${layout}`)}</span>
                <span className="text-muted-foreground text-xs">
                  {t(`layoutHints.${layout}`)}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup
          aria-label={t("viewOptions")}
          selectionMode="multiple"
          selectedKeys={HIDES.filter((hide) => view[hide])}
          onSelectionChange={chooseHides}
        >
          {HIDES.map((hide) => (
            <DropdownMenuItem key={hide} id={hide}>
              {t(hide)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}

/** Phones with more than one camera get a switch, as in both apps. */
function FlipCamera() {
  const t = useTranslations("Meeting");
  const { camera } = useRoomMedia();
  if (camera.devices.length < 2) return null;
  return (
    <Button
      aria-label={t("flipCamera")}
      onPress={() => void camera.flip()}
      className={`md:hidden ${iconButton}`}
    >
      <SwitchCamera className="size-5" aria-hidden="true" />
    </Button>
  );
}

/** A lock beside the title while a host has locked the meeting. */
function LockedMark() {
  const t = useTranslations("Meeting");
  const locked = useRoomMedia().sessionState?.locked ?? false;
  if (!locked) return null;
  return (
    <TooltipTrigger delay={300}>
      <Button className="text-muted-foreground focus-visible:focus-ring flex size-7 items-center justify-center rounded-lg outline-hidden hover:bg-white/10">
        <Lock className="size-4" aria-label={t("locked")} />
      </Button>
      <Tooltip>{t("lockedHelp")}</Tooltip>
    </TooltipTrigger>
  );
}

/** Meeting name and info on the left; switch camera, timer and Layout on the right. */
export function TopBar({
  title,
  meeting,
  session,
  endsAt,
  view,
  onViewChange,
  notes,
  inert,
}: {
  title: string;
  meeting: AdmittedMeetingInfo;
  session: SessionInfo;
  endsAt: number | null;
  view: StageView;
  onViewChange: (view: StageView) => void;
  /** "AI notes on", while they are. */
  notes?: ReactNode;
  /** Out of reach while a sheet covers the room (phones). */
  inert?: boolean;
}) {
  // Joining replaces the screen; focus starts at the meeting's name (2.4.3).
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  return (
    <header
      inert={inert}
      className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:px-5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <MeetingInfo meeting={meeting} />
        <h1
          ref={heading}
          tabIndex={-1}
          className="truncate text-base font-semibold outline-none"
        >
          {title}
        </h1>
        <span className="text-muted-foreground font-mono text-[13px] whitespace-nowrap max-sm:hidden">
          {formatMeetingCode(meeting.code)}
        </span>
        <LockedMark />
      </div>
      {/* The controls keep their size; the meeting's name gives way. */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {notes}
        <FlipCamera />
        <TimeLimit session={session} endsAt={endsAt} />
        <Elapsed session={session} endsAt={endsAt} />
        <LayoutMenu view={view} onChange={onViewChange} />
      </div>
    </header>
  );
}
