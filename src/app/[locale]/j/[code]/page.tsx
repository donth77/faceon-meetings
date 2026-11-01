import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { MeetingEntryLoader } from "@/components/meeting/entry-loader";
import { EntryLoading } from "@/components/meeting/entry-loading";
import { MeetingNotice } from "@/components/meeting/meeting-notice";
import { getSession } from "@/lib/auth/session";
import { avatarUrl } from "@/lib/avatars/seed";
import { getMeetingSummary } from "@/lib/meetings/queries";

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
  const [summary, session] = await Promise.all([
    getMeetingSummary(code),
    getSession(),
  ]);
  if (!summary) return <MeetingNotice kind="notFound" code={code} />;
  if (!summary.joinable) return <MeetingNotice kind="ended" code={code} />;

  return (
    <MeetingEntryLoader
      code={code}
      meeting={{
        code,
        title: summary.title,
        hostName: summary.hostName,
      }}
      viewer={
        session
          ? { name: session.user.name, image: avatarUrl(session.user) }
          : null
      }
    />
  );
}
