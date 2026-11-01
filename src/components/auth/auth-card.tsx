import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { publicEnv } from "@/lib/env";

import { SocialSignIn, type AuthMode } from "./social-sign-in";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

/** The sign-in and sign-up page body: same buttons, different heading and cross-link. */
export async function AuthCard({ mode }: { mode: AuthMode }) {
  const t = await getTranslations("Auth");
  const signUp = mode === "sign-up";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section
        aria-labelledby="auth-title"
        className="bg-card text-card-foreground flex w-full max-w-sm flex-col gap-6 rounded-2xl border p-8 shadow-sm"
      >
        <Link href="/" className="self-start rounded-md">
          <Image
            src="/brand/logo-lockup.svg"
            alt={appName}
            width={979}
            height={224}
            className="h-8 w-auto dark:hidden"
          />
          <Image
            src="/brand/logo-lockup-dark.svg"
            alt={appName}
            width={979}
            height={224}
            className="hidden h-8 w-auto dark:block"
          />
        </Link>

        <div className="flex flex-col gap-2">
          <h1 id="auth-title" className="font-display text-2xl font-bold">
            {t(signUp ? "signUpTitle" : "signInTitle", { appName })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t(signUp ? "signUpSubtitle" : "signInSubtitle")}
          </p>
        </div>

        {/* useSearchParams needs a Suspense boundary so the rest of the page can prerender. */}
        <Suspense fallback={<div className="h-28" aria-hidden="true" />}>
          <SocialSignIn mode={mode} />
        </Suspense>

        <p className="text-muted-foreground text-sm">
          {t(signUp ? "haveAccount" : "newHere", { appName })}{" "}
          <Link
            href={signUp ? "/sign-in" : "/sign-up"}
            className="text-primary font-semibold underline-offset-4 hover:underline"
          >
            {t(signUp ? "signInLink" : "signUpLink")}
          </Link>
        </p>

        <p className="text-muted-foreground border-t pt-4 text-xs">
          {t("guestNote")}
        </p>
      </section>
    </main>
  );
}
