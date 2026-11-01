import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireSession } from "@/lib/auth/session";
import { HOME_ROUTE } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return { title: t("title") };
}

/** Placeholder home until the dashboard shell lands: proves sign-in end to end. */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Suspense fallback={<p className="text-muted-foreground">…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const session = await requireSession(HOME_ROUTE);
  const t = await getTranslations("Home");
  return (
    <>
      <h1 className="font-display text-3xl font-bold">
        {t("welcome", { name: session.user.name })}
      </h1>
      <p className="text-muted-foreground">{t("placeholder")}</p>
      <SignOutButton />
    </>
  );
}
