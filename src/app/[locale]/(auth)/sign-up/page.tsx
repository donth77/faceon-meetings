import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("signUpTitle", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }),
  };
}

export default function SignUpPage() {
  return <AuthCard mode="sign-up" />;
}
