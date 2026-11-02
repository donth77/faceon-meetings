import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Clock } from "@/components/home/clock";
import {
  PersonalRoomCard,
  ScheduleCard,
  TodayList,
} from "@/components/home/home-cards";
import { NewMeetingMenu } from "@/components/home/new-meeting-menu";
import { JoinForm } from "@/components/meetings/join-form";
import { requireSession } from "@/lib/auth/session";
import { demoTerms, hostingPlan } from "@/lib/meetings/hosting";
import { getOrCreatePersonalRoom } from "@/lib/meetings/queries";
import { upcomingSoon } from "@/lib/meetings/scheduling";
import { HOME_ROUTE } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return { title: t("title") };
}

/** Home: the time, start or join a meeting, your personal room, and today's meetings. */
export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <div className="flex w-full max-w-[1040px] flex-col gap-9">
        <h1 className="sr-only">{t("title")}</h1>
        <Suspense fallback={null}>
          <DemoNote />
        </Suspense>
        <Clock />
        <section
          aria-label={t("actionsLabel")}
          className="flex flex-wrap items-start gap-3"
        >
          <NewMeetingMenu />
          <div className="max-w-[540px] min-w-0 flex-[1_1_360px]">
            <JoinForm />
          </div>
        </section>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          <Suspense fallback={<div className="min-h-48" aria-busy="true" />}>
            <PersonalRoom />
          </Suspense>
          <ScheduleCard />
        </div>
        <Suspense fallback={null}>
          <Today />
        </Suspense>
      </div>
    </main>
  );
}

/** Hosts who aren't allowlisted host demo meetings; say so up front. */
async function DemoNote() {
  const session = await requireSession(HOME_ROUTE);
  if (hostingPlan(session.user) === "full") return null;
  const t = await getTranslations("Home");
  return (
    <p className="rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
      {t("demoNote", demoTerms())}
    </p>
  );
}

async function PersonalRoom() {
  const session = await requireSession(HOME_ROUTE);
  const room = await getOrCreatePersonalRoom(session.user.id);
  return (
    <PersonalRoomCard
      room={{
        code: room.code,
        passcode: room.passcode,
        title: room.title,
        hostName: session.user.name,
        waitingRoom: room.settings.waitingRoom,
      }}
    />
  );
}

async function Today() {
  const session = await requireSession(HOME_ROUTE);
  const items = await upcomingSoon(session.user, 2);
  return (
    <TodayList
      rows={items.map((item) => ({
        ...item,
        start: item.start.toISOString(),
        end: item.end.toISOString(),
        originalStart: item.originalStart.toISOString(),
      }))}
    />
  );
}
