import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { publicEnv } from "@/lib/env";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

// The lockup's intrinsic size (its SVG viewBox), so the browser reserves space before it loads.
const LOCKUP = { width: 979, height: 224 };

export default async function Home() {
  const t = await getTranslations("Landing");
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
    </main>
  );
}
