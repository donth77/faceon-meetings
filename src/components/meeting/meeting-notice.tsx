import { useTranslations } from "next-intl";

import { LinkButton } from "@/components/ui/button";

import { MeetingCard, MeetingPageFrame } from "./page-frame";

export type NoticeKind =
  "notFound" | "ended" | "signIn" | "removed" | "tooManyTries";

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

  return (
    <MeetingPageFrame>
      <MeetingCard title={t(`${kind}.title`)} body={t(`${kind}.body`)}>
        {signIn ? (
          <LinkButton
            href={`/sign-in?next=${encodeURIComponent(`/j/${code}`)}`}
            className={bigButton}
          >
            {t("signInAction")}
          </LinkButton>
        ) : null}
        <LinkButton
          href="/"
          variant={signIn ? "outline" : "default"}
          className={bigButton}
        >
          {t("returnHome")}
        </LinkButton>
      </MeetingCard>
    </MeetingPageFrame>
  );
}
