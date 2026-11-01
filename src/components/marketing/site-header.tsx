import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

/** Header for public pages: logo, Help, Sign in and a primary Sign up. */
export async function SiteHeader() {
  const t = await getTranslations("Landing");

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Link href="/" className="rounded-md">
        <Image
          src="/brand/logo-lockup.svg"
          alt={appName}
          width={979}
          height={224}
          priority
          className="h-7 w-auto dark:hidden"
        />
        <Image
          src="/brand/logo-lockup-dark.svg"
          alt={appName}
          width={979}
          height={224}
          priority
          className="hidden h-7 w-auto dark:block"
        />
      </Link>
      <nav
        aria-label={t("primaryNav")}
        className="flex items-center gap-1 sm:gap-2"
      >
        <Link
          href="/help"
          className="text-muted-foreground hover:text-foreground hidden rounded-md px-3 py-2 text-sm font-medium sm:inline-block"
        >
          {t("help")}
        </Link>
        <LinkButton href="/sign-in" variant="ghost">
          {t("signIn")}
        </LinkButton>
        <LinkButton href="/sign-up">{t("signUp")}</LinkButton>
      </nav>
    </header>
  );
}
