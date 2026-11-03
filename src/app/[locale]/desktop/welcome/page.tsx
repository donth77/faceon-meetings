import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LogoMark } from "@/components/brand/logo-lockup";
import { JoinForm } from "@/components/meetings/join-form";
import { LinkButton } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DesktopWelcome");
  return { title: t("title", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }) };
}

/**
 * The desktop app's first screen, signed out (it opens here; signed in, the proxy sends
 * it Home): join a meeting, sign in or create an account, all at the app's first size.
 */
export default async function DesktopWelcomePage() {
  const t = await getTranslations("DesktopWelcome");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 px-5 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark decorative className="size-14" />
        <h1 className="font-display text-3xl font-bold text-balance">
          {t("title", { appName })}
        </h1>
        <p className="text-muted-foreground max-w-[44ch] text-[15px] leading-normal">
          {t("intro")}
        </p>
      </div>
      <section aria-labelledby="welcome-join" className="w-full max-w-[440px]">
        <h2 id="welcome-join" className="sr-only">
          {t("join")}
        </h2>
        <JoinForm variant="hero" />
      </section>
      <div
        aria-hidden="true"
        className="text-muted-foreground flex w-full max-w-[440px] items-center gap-3 text-sm"
      >
        <span className="bg-border h-px flex-1" />
        {t("or")}
        <span className="bg-border h-px flex-1" />
      </div>
      <div className="flex w-full max-w-[440px] flex-col gap-2.5 sm:flex-row">
        <LinkButton href="/sign-in" className="h-11 flex-1">
          {t("signIn")}
        </LinkButton>
        <LinkButton href="/sign-up" variant="outline" className="h-11 flex-1">
          {t("signUp")}
        </LinkButton>
      </div>
      <p className="text-muted-foreground text-sm">{t("noAccount")}</p>
    </main>
  );
}
