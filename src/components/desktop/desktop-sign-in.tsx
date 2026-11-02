"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { FormNotice } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { signIn, signOut } from "@/lib/auth/client";
import { markDesktopAppKnown } from "@/lib/desktop/app-known";
import type { HandoffProvider } from "@/lib/desktop/handoff-params";
import { useDesktop } from "@/lib/desktop/use-desktop";
import { publicEnv } from "@/lib/env";

type Step = "confirm" | "handing" | "done" | "failed";

function Card({
  title,
  body,
  children,
}: {
  title: string;
  body?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="bg-card ring-border flex w-full max-w-[440px] flex-col gap-4 rounded-2xl p-7 shadow-sm ring-1">
      <h1 className="text-2xl font-bold text-balance">{title}</h1>
      {body ? (
        <p className="text-muted-foreground text-[15px] leading-normal">
          {body}
        </p>
      ) : null}
      {children}
    </section>
  );
}

const LINK =
  "text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline";

/**
 * Signing the desktop app in through the browser: confirm who's signing in, then hand
 * the app a one-time token through faceon://auth (lib/desktop/handoff.ts). It always
 * asks, even right after signing in, so a link can't sign an app in unnoticed.
 */
export function DesktopSignIn({
  request,
  provider,
  failed,
  user,
}: {
  request: { state: string; challenge: string } | null;
  provider: HandoffProvider | null;
  failed: boolean;
  user: { name: string; email: string } | null;
}) {
  const t = useTranslations("DesktopSignIn");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const desktop = useDesktop();
  const [step, setStep] = useState<Step>("confirm");
  const [appLink, setAppLink] = useState<string | null>(null);
  const started = useRef(false);
  const here = request
    ? `/desktop/sign-in?${new URLSearchParams({ state: request.state, challenge: request.challenge })}`
    : null;

  // Signed out, from the app's Google or GitHub button: straight to that sign-in.
  useEffect(() => {
    if (desktop || user || !here || !provider || failed || started.current) {
      return;
    }
    started.current = true;
    void signIn.social({
      provider,
      callbackURL: here,
      errorCallbackURL: `${here}&error=1`,
    });
  }, [desktop, user, here, provider, failed]);

  if (desktop) {
    // Inside the app this page only explains a sign-in that didn't finish.
    return (
      <Card
        title={t(failed ? "expiredTitle" : "inAppTitle")}
        body={t(failed ? "expiredBody" : "inAppBody", { appName })}
      >
        <div className="flex flex-col gap-2.5">
          <Button onPress={() => desktop.signIn("google")}>
            {t("continueWith", { provider: "Google" })}
          </Button>
          <Button variant="outline" onPress={() => desktop.signIn("github")}>
            {t("continueWith", { provider: "GitHub" })}
          </Button>
        </div>
        <Link href="/sign-in" className={LINK}>
          {t("useEmail")}
        </Link>
      </Card>
    );
  }

  if (!request || !here) {
    return (
      <Card
        title={t("incompleteTitle")}
        body={t("incompleteBody", { appName })}
      />
    );
  }

  if (!user) {
    return (
      <Card
        title={t("signInTitle", { appName })}
        body={t("signInBody", { appName })}
      >
        {failed ? (
          <FormNotice icon={Info}>{t("signInFailed")}</FormNotice>
        ) : null}
        <Link
          href={`/sign-in?next=${encodeURIComponent(here)}`}
          className={LINK}
        >
          {t("signIn")}
        </Link>
      </Card>
    );
  }

  async function handOff(challenge: string, state: string) {
    setStep("handing");
    const response = await fetch("/api/auth/desktop/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challenge }),
    }).catch(() => null);
    const body: unknown = response?.ok
      ? await response.json().catch(() => null)
      : null;
    const token =
      body && typeof body === "object" && "token" in body
        ? String(body.token)
        : null;
    if (!token) {
      setStep("failed");
      return;
    }
    markDesktopAppKnown();
    const link = `faceon://auth?${new URLSearchParams({ state, token })}`;
    setAppLink(link);
    setStep("done");
    window.location.href = link;
  }

  if (step === "done" && appLink) {
    return (
      <Card
        title={t("doneTitle", { appName })}
        body={t("doneBody", { appName })}
      >
        <a href={appLink} className={LINK}>
          {t("openAgain", { appName })}
        </a>
      </Card>
    );
  }

  return (
    <Card
      title={t("confirmTitle", { appName })}
      body={t("confirmBody", { name: user.name, email: user.email })}
    >
      {step === "failed" ? (
        <FormNotice icon={Info}>{t("failed")}</FormNotice>
      ) : null}
      <div className="flex flex-col gap-2.5">
        <Button
          isPending={step === "handing"}
          onPress={() => void handOff(request.challenge, request.state)}
        >
          {t("continueAs", { name: user.name })}
        </Button>
        <Button
          variant="outline"
          onPress={() =>
            void signOut().then(() => window.location.assign(here))
          }
        >
          {t("notYou")}
        </Button>
      </div>
    </Card>
  );
}
