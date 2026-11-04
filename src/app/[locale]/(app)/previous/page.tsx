import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CardsLoading } from "@/components/app-shell/loading";
import { PreviousLoader } from "@/components/history/previous-loader";
import { requireSession } from "@/lib/auth/session";
import { previousMeetings } from "@/lib/meetings/history";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Previous");
  return { title: t("title") };
}

export default async function PreviousPage() {
  const t = await getTranslations("Previous");
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3">
        <h1 className="tracking-snug text-[32px] font-bold">{t("title")}</h1>
        <Suspense fallback={<CardsLoading />}>
          <Meetings />
        </Suspense>
      </div>
    </main>
  );
}

async function Meetings() {
  const session = await requireSession("/previous");
  return <PreviousLoader meetings={await previousMeetings(session.user)} />;
}
