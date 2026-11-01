import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { JoinCard, SignInCard } from "@/components/auth/sign-in-card";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("signInTitle", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }),
  };
}

export default function SignInPage() {
  return (
    <AuthPage links="sign-up">
      <SignInCard />
      <JoinCard />
    </AuthPage>
  );
}
