import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ScheduleFormLoader } from "@/components/schedule/schedule-loader";
import { requireSession } from "@/lib/auth/session";
import { newScheduleDraft } from "@/lib/meetings/schedule-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Schedule");
  return { title: t("title") };
}

export default function SchedulePage() {
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <NewMeeting />
      </Suspense>
    </main>
  );
}

/** Schedule a meeting: a fresh meeting ID and passcode the invitation can preview. */
async function NewMeeting() {
  const session = await requireSession("/schedule");
  const draft = await newScheduleDraft();
  return <ScheduleFormLoader hostName={session.user.name} draft={draft} />;
}
