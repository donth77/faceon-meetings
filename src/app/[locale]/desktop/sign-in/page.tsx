import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { DesktopSignIn } from "@/components/desktop/desktop-sign-in";
import { getSession } from "@/lib/auth/session";
import { CHALLENGE, PROVIDERS, STATE } from "@/lib/desktop/handoff-params";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DesktopSignIn");
  return { title: t("title", { appName: publicEnv.NEXT_PUBLIC_APP_NAME }) };
}

/**
 * Where the desktop app sends people to sign in with Google or GitHub, in their
 * browser; desktop/README.md has the whole flow. Inside the app, it explains a sign-in
 * that didn't finish.
 */
export default function DesktopSignInPage({
  searchParams,
}: PageProps<"/[locale]/desktop/sign-in">) {
  return (
    <AuthPage links="none">
      <Suspense fallback={<div className="min-h-64" aria-busy="true" />}>
        <Handoff searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  );
}

async function Handoff({
  searchParams,
}: Pick<PageProps<"/[locale]/desktop/sign-in">, "searchParams">) {
  const query = await searchParams;
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : "";
  const state = one(query.state);
  const challenge = one(query.challenge);
  const provider = PROVIDERS.find((name) => name === one(query.provider));
  const session = await getSession();
  return (
    <DesktopSignIn
      request={
        STATE.test(state) && CHALLENGE.test(challenge)
          ? { state, challenge }
          : null
      }
      provider={provider ?? null}
      failed={one(query.error) !== ""}
      user={
        session ? { name: session.user.name, email: session.user.email } : null
      }
    />
  );
}
