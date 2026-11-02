import { useTranslations } from "next-intl";

import { JoinForm } from "@/components/meetings/join-form";
import { LinkButton } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { formatMeetingCode } from "@/lib/meetings/codes";
import type { ClosedReason } from "@/lib/meetings/rules";
import { meetingPath, signInPath } from "@/lib/routes";

import { MeetingCard, MeetingPageFrame } from "./page-frame";

export type NoticeKind =
  "notFound" | ClosedReason | "signIn" | "removed" | "tooManyTries";

/** Notices where the way on is another meeting ID or link, right here. */
const JOIN_ANOTHER: ReadonlySet<NoticeKind> = new Set([
  "notFound",
  "ended",
  "cancelled",
  "expired",
  "removed",
]);

const bigButton = "h-12 px-6 text-base";

/** Why someone can't join right now, with the way forward. */
export function MeetingNotice({
  kind,
  code,
}: {
  kind: NoticeKind;
  code: string;
}) {
  const t = useTranslations("Meeting.notices");
  const signIn = kind === "signIn";
  const joinAnother = JOIN_ANOTHER.has(kind);

  return (
    <MeetingPageFrame>
      <MeetingCard
        title={t(`${kind}.title`)}
        body={t(`${kind}.body`, { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
      >
        {joinAnother ? (
          <div className="w-full text-left">
            <JoinForm
              label={kind === "notFound" ? t("retry") : t("joinAnother")}
              // The ID that led nowhere, ready to correct (a typo in a link, say).
              defaultValue={
                kind === "notFound" && /^\d{1,15}$/.test(code)
                  ? formatMeetingCode(code)
                  : ""
              }
            />
          </div>
        ) : null}
        {signIn ? (
          <LinkButton
            href={signInPath(meetingPath(code))}
            className={bigButton}
          >
            {t("signInAction")}
          </LinkButton>
        ) : null}
        <LinkButton
          href="/"
          variant={signIn || joinAnother ? "outline" : "default"}
          className={bigButton}
        >
          {t("returnHome")}
        </LinkButton>
      </MeetingCard>
    </MeetingPageFrame>
  );
}
