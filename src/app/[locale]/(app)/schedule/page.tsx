import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import type { ScheduleFormValues } from "@/components/schedule/schedule-form";
import { ScheduleFormLoader } from "@/components/schedule/schedule-loader";
import { requireSession } from "@/lib/auth/session";
import { findMeetingByCode } from "@/lib/meetings/queries";
import { newScheduleDraft } from "@/lib/meetings/schedule-draft";
import { inviteesOf } from "@/lib/meetings/scheduling";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Schedule");
  return { title: t("title") };
}

export default function SchedulePage(props: PageProps<"/[locale]/schedule">) {
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <NewMeeting {...props} />
      </Suspense>
    </main>
  );
}

/**
 * Schedule a meeting: a fresh meeting ID and passcode the invitation can preview.
 * `?again=` (Schedule again, from Previous) starts from an earlier meeting: its title,
 * and when you hosted it, its length, settings and invitees.
 */
async function NewMeeting({ searchParams }: PageProps<"/[locale]/schedule">) {
  const session = await requireSession("/schedule");
  const draft = newScheduleDraft();
  const { again } = await searchParams;
  const earlier =
    typeof again === "string" ? await findMeetingByCode(again) : null;
  let initial: Partial<ScheduleFormValues> | undefined;
  if (earlier) {
    const mine = earlier.meeting.hostId === session.user.id;
    initial = {
      title: earlier.meeting.title ?? "",
      ...(mine
        ? {
            description: earlier.meeting.description ?? "",
            durationMin: earlier.meeting.durationMin ?? 60,
            passcode: earlier.meeting.passcode !== null,
            waitingRoom: earlier.meeting.settings.waitingRoom,
            allowGuests: earlier.meeting.settings.allowGuests,
            joinBeforeHost: earlier.meeting.settings.joinBeforeHost,
            muteOnEntry: earlier.meeting.settings.muteOnEntry,
            invitees: await inviteesOf(earlier.meeting.id),
          }
        : {}),
    };
  }
  return (
    <ScheduleFormLoader
      hostName={session.user.name}
      draft={draft}
      initial={initial}
    />
  );
}
