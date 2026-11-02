import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CardsLoading } from "@/components/app-shell/loading";
import type { UpcomingRow } from "@/components/schedule/upcoming-list";
import { UpcomingLoader } from "@/components/schedule/upcoming-loader";
import { LinkButton } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { upcomingSoon } from "@/lib/meetings/scheduling";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Upcoming");
  return { title: t("title") };
}

export default async function UpcomingPage() {
  const t = await getTranslations("Upcoming");
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[32px] font-bold tracking-[-0.01em]">
            {t("title")}
          </h1>
          <LinkButton href="/schedule" className="h-[38px] rounded-[10px]">
            <CalendarPlus aria-hidden="true" />
            {t("schedule")}
          </LinkButton>
        </div>
        <Suspense fallback={<CardsLoading />}>
          <Meetings />
        </Suspense>
      </div>
    </main>
  );
}

/** The next eight weeks of meetings you host or are invited to. */
async function Meetings() {
  const session = await requireSession("/upcoming");
  const items = await upcomingSoon(session.user, 56);
  const rows: UpcomingRow[] = items.slice(0, 200).map((item) => ({
    ...item,
    start: item.start.toISOString(),
    end: item.end.toISOString(),
    originalStart: item.originalStart.toISOString(),
  }));
  return <UpcomingLoader rows={rows} />;
}
