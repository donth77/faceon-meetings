import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import type { ScheduleFormValues } from "@/components/schedule/schedule-form";
import { ScheduleFormLoader } from "@/components/schedule/schedule-loader";
import { requireSession } from "@/lib/auth/session";
import { calendarConnection } from "@/lib/google-calendar/connection";
import { notesAllowedFor } from "@/lib/meetings/notes";
import {
  findMeetingByCode,
  storedScheduleDefaults,
} from "@/lib/meetings/queries";
import { rememberedOptions } from "@/lib/meetings/schedule-defaults";
import { newScheduleDraft } from "@/lib/meetings/schedule-draft";
import { invitationsOf } from "@/lib/meetings/scheduling";

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
 * Schedule a meeting: a fresh meeting ID and passcode the invitation can preview. It
 * starts from the options you last scheduled with (schedule-defaults.ts). `?again=`
 * (Schedule again, from Previous) starts from an earlier meeting instead: its title,
 * and when you hosted it, its length, settings and invitees.
 */
async function NewMeeting({ searchParams }: PageProps<"/[locale]/schedule">) {
  const session = await requireSession("/schedule");
  const draft = newScheduleDraft();
  const { again } = await searchParams;
  const [earlier, connection, aiNotesAllowed, stored] = await Promise.all([
    typeof again === "string" ? findMeetingByCode(again) : null,
    calendarConnection(session.user),
    notesAllowedFor(session.user.id),
    storedScheduleDefaults(session.user.id),
  ]);
  let initial: Partial<ScheduleFormValues> = rememberedOptions(stored, {
    aiNotes: aiNotesAllowed,
    calendar: connection.status === "connected",
  });
  if (earlier) {
    const mine = earlier.meeting.hostId === session.user.id;
    initial = {
      ...initial,
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
            autoNotes: earlier.meeting.settings.autoNotes,
            shareNotes: earlier.meeting.settings.shareNotes,
            ...(await invitationsOf(earlier.meeting.id).then(
              ({ invitees, cohosts }) => ({ invitees, cohosts }),
            )),
          }
        : {}),
    };
  }
  return (
    <ScheduleFormLoader
      hostName={session.user.name}
      calendar={{
        connection,
        email: session.user.email,
        synced: false,
      }}
      aiNotesAllowed={aiNotesAllowed}
      draft={draft}
      initial={initial}
    />
  );
}
