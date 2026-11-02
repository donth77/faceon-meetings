import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthCard, AuthCardIcon } from "@/components/auth/auth-card";
import { AuthPage } from "@/components/auth/auth-page";
import { LinkButton } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { firstName } from "@/lib/names";
import { HOME_ROUTE, safeRedirectPath, signInPath } from "@/lib/routes";

/** The title says what happened, as the card does: verified, or the link didn't work. */
export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const [params, session, t] = await Promise.all([
    searchParams,
    getSession(),
    getTranslations("Auth"),
  ]);
  const failed = Boolean(single(params.error)) || !session;
  return { title: t(failed ? "verified.failedTitle" : "verified.title") };
}

const bigButton = "h-[50px] rounded-xl text-base font-semibold";

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** Where the link in a verification email lands, after Better Auth has checked it. */
export default function VerifyEmailPage({
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  return (
    <AuthPage links="none">
      <Suspense fallback={<div className="h-72" aria-hidden="true" />}>
        <VerifyEmailResult searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  );
}

async function VerifyEmailResult({
  searchParams,
}: Pick<PageProps<"/[locale]/verify-email">, "searchParams">) {
  const [params, session, t] = await Promise.all([
    searchParams,
    getSession(),
    getTranslations("Auth"),
  ]);
  const destination = safeRedirectPath(single(params.next));

  // A bad or expired link comes back with ?error= and leaves nobody signed in.
  if (single(params.error) || !session) {
    return (
      <AuthCard
        title={t("verified.failedTitle")}
        subtitle={t("verified.failedBody")}
      >
        <LinkButton href={signInPath(destination)} className={bigButton}>
          {t("verified.signIn")}
        </LinkButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("verified.title")}
      subtitle={t("verified.body", {
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        name: firstName(session.user.name),
      })}
      icon={
        <AuthCardIcon tone="success">
          <Check className="size-7" />
        </AuthCardIcon>
      }
    >
      <LinkButton href={destination} className={bigButton}>
        {destination === HOME_ROUTE
          ? t("verified.home")
          : t("verified.continue")}
        <ArrowRight className="size-[18px]" aria-hidden="true" />
      </LinkButton>
    </AuthCard>
  );
}
