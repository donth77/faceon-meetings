import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { cache, Suspense } from "react";

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
import { desktopAppUsedBy } from "@/lib/desktop/usage";
import { hostingAccessOf } from "@/lib/hosting/access";
import { demoTerms, fullTerms } from "@/lib/meetings/hosting";
import { liveOccurrenceKeys, occurrenceKey } from "@/lib/meetings/live";
import { getOrCreatePersonalRoom } from "@/lib/meetings/queries";
import { upcomingSoon } from "@/lib/meetings/scheduling";
import { demoMeetingsLeft, liveMeetingsFor } from "@/lib/meetings/sessions";
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
        <Suspense fallback={null}>
          <AppCard />
        </Suspense>
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

/** The one-time app card, which knows whether this account uses the desktop app. */
async function AppCard() {
  const session = await requireSession(HOME_ROUTE);
  return (
    <InstallCard desktopAppUsed={await desktopAppUsedBy(session.user.id)} />
  );
}

/**
 * This account's meetings that are live now (liveMeetingsFor), looked at once per
 * request: the personal room and Today both ask. Only when someone really opens Home,
 * never in a prefetch's prerender (connection() waits for that): a prefetched Live
 * would be stale, and the prerender would cut off the calls to the media provider.
 */
const liveNow = cache(async () => {
  await connection();
  const session = await requireSession(HOME_ROUTE);
  return liveMeetingsFor(session.user, new Date());
});

async function PersonalRoom() {
  const session = await requireSession(HOME_ROUTE);
  const [room, live] = await Promise.all([
    getOrCreatePersonalRoom(session.user.id),
    liveNow(),
  ]);
  return (
    <PersonalRoomCard
      room={{
        code: room.code,
        passcode: room.passcode,
        title: room.title,
        hostName: session.user.name,
        waitingRoom: room.settings.waitingRoom,
      }}
      live={live.some(({ meeting }) => meeting.id === room.id)}
    />
  );
}

async function Today() {
  const session = await requireSession(HOME_ROUTE);
  const [items, live] = await Promise.all([
    upcomingSoon(session.user, 2),
    liveNow(),
  ]);
  const now = new Date();
  const liveKeys = liveOccurrenceKeys(
    items,
    new Set(live.map(({ meeting }) => meeting.code)),
    now,
  );
  const listed = new Set(items.map((item) => item.code));
  // Your own live meetings with no time on the list: instant ones, mostly.
  const running = live.filter(
    ({ meeting }) =>
      meeting.hostId === session.user.id &&
      meeting.type !== "personal" &&
      !listed.has(meeting.code),
  );
  return (
    <TodayList
      rows={items.map((item) => ({
        ...item,
        start: item.start.toISOString(),
        end: item.end.toISOString(),
        originalStart: item.originalStart.toISOString(),
        live: liveKeys.has(occurrenceKey(item.code, item.originalStart)),
      }))}
      running={running.map(({ meeting, since }) => ({
        code: meeting.code,
        title: meeting.title,
        hostName: session.user.name,
        passcode: meeting.passcode,
        allowGuests: meeting.settings.allowGuests,
        since: since.toISOString(),
      }))}
      roomLive={live.some(({ meeting }) => meeting.type === "personal")}
    />
  );
}
