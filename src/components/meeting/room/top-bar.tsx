"use client";

import {
  ChevronDown,
  Clock3,
  Copy,
  LayoutGrid,
  Link2,
  ShieldCheck,
  SwitchCamera,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Dialog, type Selection } from "react-aria-components";

import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import type { AdmittedMeetingInfo, SessionInfo } from "@/lib/meetings/api";
import { formatMeetingCode } from "@/lib/meetings/codes";

import { useInvitation } from "../invitation";
import { useRoomMedia } from "../media";
import type { LayoutChoice } from "./stage";

const LAYOUTS: LayoutChoice[] = ["auto", "gallery", "speaker"];

const iconButton =
  "flex size-9 items-center justify-center rounded-[10px] outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring";

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
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold outline-none focus-visible:ring-2"
          >
            <Link2 className="size-4" aria-hidden="true" />
            {t("copyLink")}
          </Button>
          <Button
            onPress={() => void copyInvitation()}
            className="focus-visible:ring-ring mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-sm font-semibold outline-none hover:bg-white/15 focus-visible:ring-2"
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
const clock = (seconds: number) =>
  `${twoDigits(Math.floor(seconds / 60))}:${twoDigits(seconds % 60)}`;

/** Shows a time limit only in its last five minutes, unless it's a demo. */
const WARN_SECONDS = 5 * 60;

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
  if (now === null || endsAt === null) return null;
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  if (!session.demo && left > WARN_SECONDS) return null;
  const urgent = left <= WARN_SECONDS;

  return (
    <TooltipTrigger delay={300}>
      <Button
        className={`focus-visible:ring-ring flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 font-mono text-sm tabular-nums outline-none focus-visible:ring-2 ${urgent ? "bg-amber-400/20 text-amber-100" : "bg-white/10"}`}
      >
        {session.demo ? (
          <span className="font-sans font-semibold">{t("demo")} ·</span>
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

/** How long the meeting has been going, from the earliest join we can see. */
function Elapsed() {
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
      className="text-foreground/85 flex items-center gap-1.5 font-mono text-sm tabular-nums"
    >
      <Clock3 className="size-4" aria-hidden="true" />
      {time}
    </span>
  );
}

function LayoutMenu({
  value,
  onChange,
}: {
  value: LayoutChoice;
  onChange: (layout: LayoutChoice) => void;
}) {
  const t = useTranslations("Meeting");

  function handleChange(keys: Selection) {
    const [next] = keys === "all" ? [] : [...keys];
    if (LAYOUTS.includes(next as LayoutChoice)) onChange(next as LayoutChoice);
  }

  return (
    <DropdownMenuTrigger>
      <Button
        aria-label={t("layoutLabel", { layout: t(`layouts.${value}`) })}
        className="focus-visible:ring-ring flex h-9 items-center gap-2 rounded-[10px] bg-white/10 pr-2.5 pl-3 text-sm outline-none hover:bg-white/15 focus-visible:ring-2"
      >
        <LayoutGrid className="size-[18px]" aria-hidden="true" />
        <span className="max-sm:hidden">{t(`layouts.${value}`)}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </Button>
      <DropdownMenu placement="bottom end" className="min-w-44">
        <DropdownMenuGroup
          aria-label={t("layout")}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[value]}
          onSelectionChange={handleChange}
        >
          {LAYOUTS.map((layout) => (
            <DropdownMenuItem key={layout} id={layout}>
              {t(`layouts.${layout}`)}
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

/** Meeting name and info on the left; switch camera, timer and Layout on the right. */
export function TopBar({
  title,
  meeting,
  session,
  endsAt,
  layout,
  onLayoutChange,
}: {
  title: string;
  meeting: AdmittedMeetingInfo;
  session: SessionInfo;
  endsAt: number | null;
  layout: LayoutChoice;
  onLayoutChange: (layout: LayoutChoice) => void;
}) {
  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <MeetingInfo meeting={meeting} />
        <h1 className="truncate text-base font-semibold">{title}</h1>
        <span className="text-muted-foreground font-mono text-[13px] whitespace-nowrap max-sm:hidden">
          {formatMeetingCode(meeting.code)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <FlipCamera />
        <TimeLimit session={session} endsAt={endsAt} />
        <Elapsed />
        <LayoutMenu value={layout} onChange={onLayoutChange} />
      </div>
    </header>
  );
}
