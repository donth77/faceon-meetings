"use client";

import { useTranslations } from "next-intl";

import { Button, LinkButton } from "@/components/ui/button";
import { formatMeetingCode } from "@/lib/meetings/codes";

import type { LeaveReason } from "./media";
import { MeetingCard, MeetingPageFrame } from "./page-frame";

/** Why the meeting closed for you. Ending it yourself is told apart from the host ending it. */
export type LeftReason = LeaveReason | "endedByYou";

/** Rejoining makes sense only when the meeting is still going. */
const CAN_REJOIN: ReadonlySet<LeftReason> = new Set(["left", "connectionLost"]);

/** "You left the meeting", worded for the reason, with Rejoin and Return home. */
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

  return (
    <MeetingPageFrame>
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
    </MeetingPageFrame>
  );
}
