import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { ForgotPasswordCard } from "@/components/auth/forgot-password-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("forgot.title") };
}

export default function ForgotPasswordPage() {
  return (
    <AuthPage links="both">
      <ForgotPasswordCard />
    </AuthPage>
  );
}
