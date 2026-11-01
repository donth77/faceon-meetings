import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Clock } from "@/components/home/clock";
import { NewMeetingMenu } from "@/components/home/new-meeting-menu";
import { JoinForm } from "@/components/meetings/join-form";
import { requireSession } from "@/lib/auth/session";
import { demoTerms, hostingPlan } from "@/lib/meetings/hosting";
import { firstName } from "@/lib/names";
import { HOME_ROUTE } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return { title: t("title") };
}

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 flex-col gap-10 p-6 md:p-10">
      <Suspense fallback={<PageHeader title={t("title")} />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={null}>
        <DemoNote />
      </Suspense>

      <section
        aria-label={t("actionsLabel")}
        className="grid max-w-5xl gap-8 lg:grid-cols-[1fr_minmax(0,26rem)]"
      >
        <div className="flex flex-col gap-6">
          <Clock />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <NewMeetingMenu />
            <div className="min-w-0 flex-1">
              <JoinForm />
            </div>
          </div>
        </div>

        <aside className="bg-card flex flex-col gap-2 rounded-2xl border p-6">
          <h2 className="font-semibold">{t("upcomingTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("upcomingEmpty")}</p>
        </aside>
      </section>
    </main>
  );
}

/** Hosts who aren't allowlisted host demo meetings; say so up front. */
async function DemoNote() {
  const session = await requireSession(HOME_ROUTE);
  if (hostingPlan(session.user) === "full") return null;
  const t = await getTranslations("Home");
  return (
    <p className="-mt-6 max-w-5xl rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
      {t("demoNote", demoTerms())}
    </p>
  );
}

async function Greeting() {
  const session = await requireSession(HOME_ROUTE);
  const t = await getTranslations("Home");
  return (
    <PageHeader title={t("welcome", { name: firstName(session.user.name) })} />
  );
}
