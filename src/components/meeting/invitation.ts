"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useOrigin } from "@/hooks/use-origin";
import { publicEnv } from "@/lib/env";
import type { AdmittedMeetingInfo } from "@/lib/meetings/api";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { meetingPath } from "@/lib/routes";

import { useMeetingTitle } from "./meeting-title";

/** The invite link, with the passcode in the fragment so it never reaches a server. */
export function inviteLink(
  origin: string,
  meeting: { code: string; passcode: string | null },
) {
  return `${origin}${meetingPath(meeting.code, meeting.passcode)}`;
}

/**
 * The meeting's link and a full invitation (host, title, link, meeting ID, passcode),
 * with Copy actions that confirm with a toast.
 */
export function useInvitation(
  meeting: Pick<
    AdmittedMeetingInfo,
    "code" | "title" | "passcode" | "hostName"
  >,
) {
  const t = useTranslations("Meeting");
  const title = useMeetingTitle(meeting);
  const link = inviteLink(useOrigin(), meeting);

  const invitation = [
    t("invitation.intro", {
      host: meeting.hostName,
      appName: publicEnv.NEXT_PUBLIC_APP_NAME,
    }),
    "",
    title,
    t("invitation.join", { link }),
    "",
    t("invitation.meetingId", { code: formatMeetingCode(meeting.code) }),
    ...(meeting.passcode
      ? [t("invitation.passcode", { passcode: meeting.passcode })]
      : []),
  ].join("\n");

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return {
    link,
    copyLink: () => copy(link, t("linkCopied")),
    copyInvitation: () => copy(invitation, t("invitationCopied")),
  };
}
