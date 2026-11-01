import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { SignUpCard } from "@/components/auth/sign-up-card";
import { emailPasswordEnabled } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("signUpTitle", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }),
  };
}

export default function SignUpPage() {
  return (
    <AuthPage links="sign-in">
      {/* The card reads ?next=, which needs a Suspense boundary to prerender. */}
      <Suspense fallback={<div className="h-[560px]" aria-hidden="true" />}>
        <SignUpCard emailEnabled={emailPasswordEnabled()} />
      </Suspense>
    </AuthPage>
  );
}
