import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";

import { MeetingEntryLoader } from "@/components/meeting/entry-loader";
import { EntryLoading } from "@/components/meeting/entry-loading";
import { MeetingNotice } from "@/components/meeting/meeting-notice";
import { getSession } from "@/lib/auth/session";
import { accountAvatar } from "@/lib/avatars/account";
import { createAvatarSeed } from "@/lib/avatars/seed";
import { currentGuest, guestsEnabled } from "@/lib/guest-session";
import { humanCheckOn } from "@/lib/human-check/verify";
import { meetingPageAttempts } from "@/lib/meetings/attempts";
import { guestMediaId, userMediaId } from "@/lib/meetings/principal";
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
  const [session, guest] = await Promise.all([getSession(), currentGuest()]);
  const [summary, limited] = await Promise.all([
    getMeetingSummary(
      code,
      session
        ? {
            userId: session.user.id,
            mediaUserId: userMediaId(session.user.id),
            verifiedEmail: session.user.emailVerified
              ? session.user.email.toLowerCase()
              : null,
          }
        : guest
          ? {
              userId: null,
              mediaUserId: guestMediaId(guest.id),
              verifiedEmail: null,
            }
          : null,
    ),
    isLimited(attempts.limits),
  ]);
  if (limited) return <MeetingNotice kind="tooManyTries" code={code} />;
  if (!summary) {
    await recordDistinctAttempt(attempts.limits, attempts.seen);
    return <MeetingNotice kind="notFound" code={code} />;
  }
  if (summary.closed)
    return <MeetingNotice kind={summary.closed} code={code} />;
  if (!session && !(guestsEnabled() && summary.allowGuests)) {
    return <MeetingNotice kind="signIn" code={code} />;
  }
  const youHost = session?.user.id === summary.hostId;

  return (
    <MeetingEntryLoader
      code={code}
      meeting={{
        code,
        title: summary.title,
        hostName: summary.hostName,
        askToJoin: summary.waitingRoom && !youHost && !summary.joinsAsCohost,
        notesOn: summary.notesOn,
        notesAuto: summary.notesAuto,
        notesShared: summary.notesShared,
        limits: summary.limits,
        youHost,
        youCohost: summary.joinsAsCohost,
        needsPasscode: summary.needsPasscode,
      }}
      viewer={
        session
          ? {
              kind: "user",
              name: session.user.name,
              avatar: accountAvatar(session.user),
            }
          : guest
            ? { kind: "guest", avatarSeed: guest.avatarSeed, firstVisit: false }
            : // Made here, so the join screen shows the avatar they'll join with.
              {
                kind: "guest",
                avatarSeed: createAvatarSeed("n"),
                firstVisit: true,
                humanCheck: humanCheckOn(),
              }
      }
    />
  );
}
