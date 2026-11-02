"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { NotesAfterMeeting } from "@/components/notes/notes-after-meeting";
import { Button, LinkButton } from "@/components/ui/button";
import { formatMeetingCode } from "@/lib/meetings/codes";

import { playSound } from "./chime";
import type { LeaveReason } from "./media";
import {
  MEETING_CARD_TITLE,
  MeetingCard,
  MeetingPageFrame,
} from "./page-frame";

/** Why the meeting closed for you. Ending it yourself is told apart from the host ending it. */
export type LeftReason = LeaveReason | "endedByYou" | "alone";

/**
 * The session you left, for AI notes taken in it: whether you're signed in to save them,
 * and whether the meeting shares them with its participants as they're made.
 */
export type LeftSession = {
  id: string;
  signedIn: boolean;
  shareNotes: boolean;
};

/** Rejoining makes sense only when the meeting is still going. */
const CAN_REJOIN: ReadonlySet<LeftReason> = new Set([
  "left",
  "alone",
  "connectionLost",
]);

/**
 * "You left the meeting", worded for the reason, with Rejoin and Return home. Whoever
 * took AI notes finds them below.
 */
export function LeftMeeting({
  reason,
  title,
  code,
  session,
  limit,
  onRejoin,
}: {
  reason: LeftReason;
  title: string;
  code: string;
  /** The session you were in; null if you never got in. */
  session: LeftSession | null;
  /** The session's time limit, named when it's what ended the meeting. */
  limit: { minutes: number; demo: boolean } | null;
  onRejoin: () => void;
}) {
  const t = useTranslations("Meeting");
  useEffect(() => {
    playSound("youLeft");
    // The room is gone; focus starts at what happened (2.4.3).
    document.getElementById(MEETING_CARD_TITLE)?.focus();
  }, []);

  return (
    <MeetingPageFrame>
      <div className="flex w-full flex-col items-center gap-6">
        <MeetingCard
          title={
            reason === "timeLimit" && limit
              ? t("left.timeLimitMinutes", { minutes: limit.minutes })
              : t(`left.${reason}`)
          }
          body={
            reason === "timeLimit" && limit?.demo
              ? `${title}. ${t("left.timeLimitDemo", { minutes: limit.minutes })}`
              : title
          }
          footer={t("meetingIdLine", { code: formatMeetingCode(code) })}
        >
          {CAN_REJOIN.has(reason) ? (
            <Button onPress={onRejoin} className="h-12 px-6 text-base">
              {t("rejoin")}
            </Button>
          ) : null}
          <LinkButton
            href="/"
            variant={CAN_REJOIN.has(reason) ? "outline" : "default"}
            className="h-12 px-6 text-base"
          >
            {t("returnHome")}
          </LinkButton>
        </MeetingCard>
        {session ? (
          <NotesAfterMeeting code={code} title={title} session={session} />
        ) : null}
      </div>
    </MeetingPageFrame>
  );
}
