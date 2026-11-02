import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthPage } from "@/components/auth/auth-page";
import { StopReminders } from "@/components/reminders/stop-reminders";
import { readUnsubscribeToken } from "@/lib/reminders/token";
import { serverEnv } from "@/lib/server-env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Unsubscribe");
  return { title: t("title") };
}

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Where a reminder email's "Stop reminder emails" leads: one button, signed in or not,
 * since the link itself says whose reminders they are.
 */
export default function UnsubscribePage({
  searchParams,
}: PageProps<"/[locale]/unsubscribe">) {
  return (
    <AuthPage links="none">
      <Suspense fallback={<div className="h-72" aria-hidden="true" />}>
        <Unsubscribe searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  );
}

async function Unsubscribe({
  searchParams,
}: Pick<PageProps<"/[locale]/unsubscribe">, "searchParams">) {
  const [params, t] = await Promise.all([
    searchParams,
    getTranslations("Unsubscribe"),
  ]);
  const token = single(params.token) ?? "";
  const secret = serverEnv().BETTER_AUTH_SECRET;
  if (!secret || !readUnsubscribeToken(token, secret)) {
    return <AuthCard title={t("invalidTitle")} subtitle={t("invalidBody")} />;
  }
  return <StopReminders token={token} />;
}
