import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { ResetPasswordCard } from "@/components/auth/reset-password-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("reset.title") };
}

export default function ResetPasswordPage() {
  return (
    <AuthPage links="sign-in">
      {/* The card reads the token from the URL, which needs a Suspense boundary. */}
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <ResetPasswordCard />
      </Suspense>
    </AuthPage>
  );
}
