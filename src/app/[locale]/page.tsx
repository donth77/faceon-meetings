import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

// The lockup's intrinsic size (its SVG viewBox), so the browser reserves space before it loads.
const LOCKUP = { width: 979, height: 224 };

export default async function Home() {
  const t = await getTranslations("Landing");
  const meta = await getTranslations("Metadata");

  // Structured data for search engines. It's built from our own static values and escaped.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: appName,
    url: siteUrl(),
    description: meta("description"),
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Any (web browser)",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    license: "https://opensource.org/license/mit",
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1>
        <Image
          src="/brand/logo-lockup.svg"
          alt={appName}
          width={LOCKUP.width}
          height={LOCKUP.height}
          priority
          className="h-14 w-auto sm:h-16 dark:hidden"
        />
        <Image
          src="/brand/logo-lockup-dark.svg"
          alt={appName}
          width={LOCKUP.width}
          height={LOCKUP.height}
          priority
          className="hidden h-14 w-auto sm:h-16 dark:block"
        />
      </h1>
      <p className="font-display max-w-md text-2xl font-bold text-balance sm:text-3xl">
        {t("tagline")}
      </p>
      <p className="text-muted-foreground max-w-md text-base">{t("subline")}</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}
