import { Video } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { WakeOnIntent } from "@/components/app-shell/wake-on-intent";
import { LogoMark } from "@/components/brand/logo-lockup";
import { DownloadForThisComputer } from "@/components/desktop/download-link";
import { Features } from "@/components/marketing/features";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { JoinForm } from "@/components/meetings/join-form";
import { LinkButton } from "@/components/ui/button";
import { wakesDatabase } from "@/lib/db/wake";
import { publicEnv } from "@/lib/env";
import { languageAlternates, siteUrl } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: languageAlternates("/", locale) };
}

/**
 * The signed-out home. Most visitors come to join a meeting, so the meeting ID field is
 * the centrepiece, and nothing suggests an account is needed for it. Signed-in visitors
 * go to /home (proxy).
 */
export default async function LandingPage() {
  const t = await getTranslations("Landing");
  const meta = await getTranslations("Metadata");

  // Structured data for search engines, built from our own static values and escaped.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: publicEnv.NEXT_PUBLIC_APP_NAME,
    url: siteUrl(),
    description: meta("description"),
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Any (web browser)",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    license: "https://opensource.org/license/mit",
  };

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center gap-10 px-4 pt-2 pb-12 sm:gap-16 sm:px-6 sm:pt-14">
        <div className="flex w-full max-w-[760px] flex-col items-center gap-4 text-center sm:gap-[22px]">
          <span className="hidden sm:block">
            <LogoMark decorative className="size-14" />
          </span>
          <h1 className="font-display tracking-display text-[36px] leading-[1.04] font-[750] text-balance sm:text-5xl lg:text-[68px] lg:leading-[1.02] lg:tracking-tight">
            {t("headline")}
          </h1>
          <p className="text-muted-foreground text-base leading-[1.45] sm:text-xl">
            {t("subline")}
          </p>
          <div className="bg-card w-full max-w-[640px] rounded-[18px] p-4 text-left shadow-[0_0_0_1px_var(--border),0_12px_28px_rgb(18_22_28/0.07)] sm:mt-2.5 sm:rounded-[20px] sm:p-6 sm:shadow-[0_0_0_1px_var(--border),0_18px_40px_rgb(18_22_28/0.08)]">
            <JoinForm variant="hero" />
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-[18px]">
            <LinkButton
              href="/sign-up"
              variant="outline"
              size="lg"
              className="bg-card h-[50px] gap-2.5 rounded-xl px-5 text-base font-bold sm:h-12 [&_svg:not([class*='size-'])]:size-5"
            >
              <Video aria-hidden="true" />
              {t("startMeeting")}
            </LinkButton>
            <p className="text-muted-foreground text-sm leading-[1.45] sm:text-[15px]">
              {t.rich("newHere", {
                link: (chunks) => (
                  <Link
                    href="/sign-up"
                    className="text-primary focus-visible:focus-ring rounded-[2px] font-semibold underline-offset-4 outline-hidden hover:underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
          <DownloadForThisComputer />
        </div>
        <Features />
      </main>
      <SiteFooter />
      {wakesDatabase() ? <WakeOnIntent /> : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
