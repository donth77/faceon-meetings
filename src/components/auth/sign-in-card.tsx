import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";

import { LegalConsent } from "@/components/legal/legal-links";
import { JoinForm } from "@/components/meetings/join-form";
import { emailPasswordEnabled } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";

import { AuthCard, OrDivider } from "./auth-card";
import { EmailSignInForm } from "./email-sign-in-form";
import { SocialSignIn } from "./social-sign-in";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

/** Sign in with Google, GitHub or email and password. */
export async function SignInCard() {
  const t = await getTranslations("Auth");
  const emailEnabled = emailPasswordEnabled();

  return (
    <AuthCard
      title={t("signInTitle", { appName })}
      subtitle={t(emailEnabled ? "signInSubtitle" : "signInSubtitleSocial")}
    >
      {/* These read ?next= and ?error=, which needs a Suspense boundary to prerender. */}
      <Suspense fallback={<div className="h-[110px]" aria-hidden="true" />}>
        <SocialSignIn mode="sign-in" />
      </Suspense>
      {emailEnabled ? (
        <>
          <OrDivider label={t("or")} />
          <Suspense fallback={<div className="h-72" aria-hidden="true" />}>
            <EmailSignInForm />
          </Suspense>
        </>
      ) : null}
      {/* A first sign-in with Google or GitHub creates the account. */}
      <LegalConsent action="signIn" />
      <p className="border-t pt-3.5 text-[15px]">
        {t("newHere", { appName })}{" "}
        <Link
          href="/sign-up"
          className="text-primary font-bold underline-offset-4 hover:underline"
        >
          {t("signUpLink")}
        </Link>
      </p>
    </AuthCard>
  );
}

/** Below sign-in: guests join from here, with no account. */
export async function JoinCard() {
  const t = await getTranslations("Auth");
  return (
    <div className="bg-card ring-border rounded-2xl px-6 py-5 ring-1">
      <JoinForm label={t("joinCard")} />
    </div>
  );
}
