import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CardsLoading } from "@/components/app-shell/loading";
import { Clock } from "@/components/home/clock";
import {
  PersonalRoomCard,
  ScheduleCard,
  TodayList,
} from "@/components/home/home-cards";
import { HostingNote } from "@/components/home/hosting-note";
import { NewMeetingMenu } from "@/components/home/new-meeting-menu";
import { JoinForm } from "@/components/meetings/join-form";
import { InstallCard } from "@/components/pwa/install-app";
import { requireSession } from "@/lib/auth/session";
import { hostingAccessOf } from "@/lib/hosting/access";
import { demoTerms, fullTerms } from "@/lib/meetings/hosting";
import { getOrCreatePersonalRoom } from "@/lib/meetings/queries";
import { upcomingSoon } from "@/lib/meetings/scheduling";
import { demoMeetingsLeft } from "@/lib/meetings/sessions";
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
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-9">
        <h1 className="sr-only">{t("title")}</h1>
        <Suspense fallback={null}>
          <Hosting />
        </Suspense>
        <Clock />
        <section
          aria-label={t("actionsLabel")}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start"
        >
          <NewMeetingMenu />
          <div className="max-w-[540px] min-w-0 sm:flex-[1_1_360px]">
            <JoinForm />
          </div>
        </section>
        <InstallCard />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          <Suspense fallback={<CardsLoading rows={2} />}>
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

/**
 * Demo hosts see their limits up front, with Ask for full meetings (or where their
 * request stands); someone an admin just approved sees that once.
 */
async function Hosting() {
  const session = await requireSession(HOME_ROUTE);
  const access = await hostingAccessOf(session.user);
  return (
    <HostingNote
      state={
        access.plan === "demo" && access.ask === "declined"
          ? { ...access, askAgainAt: access.askAgainAt.toISOString() }
          : access
      }
      terms={{
        demo: {
          ...demoTerms(),
          left: (await demoMeetingsLeft(session.user, new Date())) ?? 0,
        },
        full: fullTerms(),
      }}
    />
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
