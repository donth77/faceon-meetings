import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ScheduleFormLoader } from "@/components/schedule/schedule-loader";
import { requireSession } from "@/lib/auth/session";
import { calendarConnection } from "@/lib/google-calendar/connection";
import { fromRRule } from "@/lib/meetings/describe";
import { meetingDetails } from "@/lib/meetings/scheduling";
import { localParts } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Schedule");
  return { title: t("editTitle") };
}

export default function EditMeetingPage(
  props: PageProps<"/[locale]/meetings/[code]/edit">,
) {
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <EditMeeting {...props} />
      </Suspense>
    </main>
  );
}

/**
 * Edit a scheduled meeting. For a series, `?occurrence=` names the meeting being edited:
 * the form starts at its time, and saving asks which meetings the change applies to.
 */
async function EditMeeting({
  params,
  searchParams,
}: PageProps<"/[locale]/meetings/[code]/edit">) {
  const { code } = await params;
  const { occurrence } = await searchParams;
  const session = await requireSession(`/meetings/${code}/edit`);
  const details = await meetingDetails({ code, viewer: session.user });
  if (!details?.isHost) notFound();

  const chosen =
    typeof occurrence === "string"
      ? details.next.find((o) => o.originalStart === occurrence)
      : undefined;
  const at = chosen
    ? localParts(new Date(chosen.start), details.timeZone)
    : { date: details.startDate, time: details.startTime };
  const minutes = chosen
    ? (new Date(chosen.end).getTime() - new Date(chosen.start).getTime()) /
      60_000
    : details.durationMin;

  return (
    <ScheduleFormLoader
      hostName={details.hostName}
      calendar={{
        connection: await calendarConnection(session.user),
        email: session.user.email,
        synced: details.onGoogleCalendar,
      }}
      edit={{
        code: details.code,
        passcode: details.passcode,
        occurrence: chosen?.originalStart ?? null,
        isSeries: details.rrule !== null,
        values: {
          title: chosen?.title ?? details.title,
          description: details.description ?? "",
          date: at.date,
          time: at.time,
          durationMin: minutes,
          timeZone: details.timeZone,
          recurrence: details.rrule
            ? fromRRule(details.rrule, details.timeZone)
            : null,
          invitees: details.invitees.map((i) => i.email),
          passcode: details.passcode !== null,
          waitingRoom: details.settings.waitingRoom,
          allowGuests: details.settings.allowGuests,
          joinBeforeHost: details.settings.joinBeforeHost,
          muteOnEntry: details.settings.muteOnEntry,
          // A meeting not on Google Calendar yet goes there only if switched on.
          googleCalendar: false,
        },
      }}
    />
  );
}
