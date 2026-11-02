import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { DownloadButtons } from "@/components/desktop/download-buttons";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { latestDesktopRelease } from "@/lib/desktop/releases";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Download");
  return {
    title: t("title", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }),
    description: t("intro", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }),
  };
}

const ADDS = [
  "links",
  "shortcut",
  "tray",
  "sound",
  "reminders",
  "updates",
] as const;

/** The desktop app for Mac and Windows: this computer's download first, then the other. */
export default async function DownloadPage() {
  const t = await getTranslations("Download");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const release = await latestDesktopRelease();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-10 px-5 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl font-bold text-balance">
            {t("title", { appName })}
          </h1>
          <p className="text-muted-foreground max-w-[60ch] text-lg leading-normal">
            {t("intro", { appName })}
          </p>
        </div>
        {release ? (
          <DownloadButtons
            version={release.version}
            publishedAt={release.publishedAt}
            mac={release.mac}
            windows={release.windows}
            page={release.page}
          />
        ) : (
          <p className="bg-card ring-border max-w-[60ch] rounded-2xl p-5 text-[15px] leading-normal ring-1">
            {t("notYet", { appName })}
          </p>
        )}
        <section aria-labelledby="adds" className="flex flex-col gap-4">
          <h2 id="adds" className="text-xl font-bold">
            {t("addsTitle")}
          </h2>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {ADDS.map((key) => (
              <li key={key} className="flex flex-col gap-0.5">
                <span className="font-semibold">{t(`adds.${key}.title`)}</span>
                <span className="text-muted-foreground text-sm leading-normal">
                  {t(`adds.${key}.body`, { appName })}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-muted-foreground text-sm leading-normal">
          {t.rich("help", {
            appName,
            link: (chunks) => (
              <Link
                href="/help/desktop-app"
                className="text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
