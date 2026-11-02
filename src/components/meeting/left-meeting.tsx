"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { NotesAfterMeeting } from "@/components/notes/notes-after-meeting";
import { Button, LinkButton } from "@/components/ui/button";
import { formatMeetingCode } from "@/lib/meetings/codes";

import { playSound } from "./chime";
import type { LeaveReason } from "./media";
import { MeetingCard, MeetingPageFrame } from "./page-frame";

/** Why the meeting closed for you. Ending it yourself is told apart from the host ending it. */
export type LeftReason = LeaveReason | "endedByYou" | "alone";

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
  onRejoin,
}: {
  reason: LeftReason;
  title: string;
  code: string;
  onRejoin: () => void;
}) {
  const t = useTranslations("Meeting");
  useEffect(() => playSound("youLeft"), []);

  return (
    <MeetingPageFrame>
      <div className="flex w-full flex-col items-center gap-6">
        <MeetingCard
          title={t(`left.${reason}`)}
          body={title}
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
        <NotesAfterMeeting code={code} title={title} />
      </div>
    </MeetingPageFrame>
  );
}
