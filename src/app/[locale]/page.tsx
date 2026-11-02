import { Video } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Features } from "@/components/marketing/features";
import { ProductShot } from "@/components/marketing/product-shot";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { JoinForm } from "@/components/meetings/join-form";
import { LinkButton } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

/**
 * The signed-out home. Most visitors come to join a meeting, so joining comes first and
 * nothing suggests an account is needed for it. Signed-in visitors go to /home (proxy).
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
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {t("headline")}
            </h1>
            <p className="text-muted-foreground text-lg">{t("subline")}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <LinkButton
                href="/sign-up"
                size="lg"
                className="h-12 gap-2.5 rounded-xl px-5 text-base font-semibold [&_svg:not([class*='size-'])]:size-5"
              >
                <Video aria-hidden="true" />
                {t("startMeeting")}
              </LinkButton>
              <div className="min-w-0 flex-1">
                <JoinForm />
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
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
          <div className="flex justify-center lg:justify-end">
            <ProductShot />
          </div>
        </section>
        <Features />
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
