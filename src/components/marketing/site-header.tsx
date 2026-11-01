import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo-lockup";
import { LinkButton } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";

import { LanguageMenu } from "./language-menu";
import { PUBLIC_CONTAINER } from "./layout";

/** Which account links the header offers: both, just the other page's, or none. */
export type HeaderAccountLinks = "both" | "sign-in" | "sign-up" | "none";

/**
 * The header on every signed-out page: logo, Help, language, then Sign in and/or a
 * primary Sign up. Same width and padding everywhere, as on the landing page.
 */
export async function SiteHeader({
  links = "both",
}: {
  links?: HeaderAccountLinks;
}) {
  const t = await getTranslations("Landing");

  return (
    <header
      className={cn(
        PUBLIC_CONTAINER,
        "flex min-h-18 items-center justify-between gap-3 py-4",
      )}
    >
      <Link
        href="/"
        aria-label={t("homeLink", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
        className="inline-flex shrink-0 rounded-md"
      >
        <LogoLockup className="h-7 sm:h-[30px]" />
      </Link>
      <nav
        aria-label={t("primaryNav")}
        className="flex min-w-0 items-center gap-1.5 sm:gap-2.5"
      >
        <Link
          href="/help"
          className="hover:bg-muted focus-visible:ring-ring hidden h-10 items-center rounded-[10px] px-3 text-[15px] font-semibold outline-none focus-visible:ring-2 sm:flex"
        >
          {t("help")}
        </Link>
        <LanguageMenu />
        {links === "both" || links === "sign-in" ? (
          <LinkButton
            href="/sign-in"
            variant="ghost"
            className="h-10 rounded-[10px] px-3.5 text-[15px] font-semibold"
          >
            {t("signIn")}
          </LinkButton>
        ) : null}
        {links === "both" || links === "sign-up" ? (
          <LinkButton
            href="/sign-up"
            className="h-10 rounded-[10px] px-4 text-[15px] font-bold"
          >
            {t("signUp")}
          </LinkButton>
        ) : null}
      </nav>
    </header>
  );
}
