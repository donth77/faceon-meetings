import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";

import { MeetingEntryLoader } from "@/components/meeting/entry-loader";
import { EntryLoading } from "@/components/meeting/entry-loading";
import { MeetingNotice } from "@/components/meeting/meeting-notice";
import { getSession } from "@/lib/auth/session";
import { avatarUrl } from "@/lib/avatars/seed";
import {
  currentGuest,
  guestAvatarUrl,
  guestsEnabled,
  NEW_GUEST_AVATAR,
} from "@/lib/guest-session";
import { meetingPageAttempts } from "@/lib/meetings/attempts";
import { getMeetingSummary } from "@/lib/meetings/queries";
import { isLimited, recordDistinctAttempt } from "@/lib/rate-limit";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meeting");
  return { title: t("pageTitle") };
}

/** /j/{meetingId}: the meeting's entry point. The server checks the ID; the client does the rest. */
export default function MeetingPage({
  params,
}: PageProps<"/[locale]/j/[code]">) {
  return (
    <Suspense fallback={<EntryLoading />}>
      <MeetingGate params={params} />
    </Suspense>
  );
}

async function MeetingGate({
  params,
}: Pick<PageProps<"/[locale]/j/[code]">, "params">) {
  const { code } = await params;
  // Unknown IDs count against the caller, as failed joins do, so trying IDs here is
  // no faster than through the join API. Only when someone really opens the page, never
  // in a prefetch's prerender (connection() waits for that).
  await connection();
  const attempts = meetingPageAttempts(await headers(), code);
  const [summary, session, guest, limited] = await Promise.all([
    getMeetingSummary(code),
    getSession(),
    currentGuest(),
    isLimited(attempts.limits),
  ]);
  if (limited) return <MeetingNotice kind="tooManyTries" code={code} />;
  if (!summary) {
    await recordDistinctAttempt(attempts.limits, attempts.seen);
    return <MeetingNotice kind="notFound" code={code} />;
  }
  if (!summary.joinable) return <MeetingNotice kind="ended" code={code} />;
  if (!session && !(guestsEnabled() && summary.allowGuests)) {
    return <MeetingNotice kind="signIn" code={code} />;
  }

  return (
    <MeetingEntryLoader
      code={code}
      meeting={{
        code,
        title: summary.title,
        hostName: summary.hostName,
        askToJoin: summary.waitingRoom && session?.user.id !== summary.hostId,
        notesOn: summary.notesOn,
      }}
      viewer={
        session
          ? {
              kind: "user",
              name: session.user.name,
              image: avatarUrl(session.user),
            }
          : {
              kind: "guest",
              name: "",
              image: guest ? guestAvatarUrl(guest) : NEW_GUEST_AVATAR,
            }
      }
    />
  );
}
