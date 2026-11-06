import { cn } from "cn";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoLockup } from "@/components/brand/logo-lockup";
import { PUBLIC_CONTAINER } from "@/components/marketing/layout";
import { publicEnv } from "@/lib/env";

import { SignInLink } from "./sign-in-link";

/**
 * Pages around a meeting (pre-join, notices, after leaving): the public header's logo
 * (plus Sign in for guests), with Home spelled out under it, since a logo isn't plainly a
 * way back (in the desktop app, it's the only one); content centered. The language is in
 * Settings → General, which the join screen's Settings has too.
 */
export function MeetingPageFrame({
  signInHref,
  children,
}: {
  /** Shown to guests, returning them here after signing in. */
  signInHref?: string;
  children: ReactNode;
}) {
  const landing = useTranslations("Landing");
  const nav = useTranslations("Nav");
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={cn(
          PUBLIC_CONTAINER,
          "flex min-h-18 items-start justify-between gap-3 py-4",
        )}
      >
        <div className="flex flex-col items-start gap-2">
          <Link
            href="/"
            aria-label={landing("homeLink", {
              appName: publicEnv.NEXT_PUBLIC_APP_NAME,
            })}
            className="inline-flex h-10 shrink-0 items-center rounded-md"
          >
            <LogoLockup className="h-7 sm:h-[30px]" />
          </Link>
          <Link
            href="/"
            className="text-primary focus-visible:focus-ring -ml-1 flex items-center gap-1 rounded-md pr-1 text-sm font-semibold outline-hidden hover:underline"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {nav("home")}
          </Link>
        </div>
        {signInHref ? <SignInLink href={signInHref} /> : null}
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-14 sm:px-10">
        {children}
      </main>
    </div>
  );
}

/** The card's heading, which a screen that replaces another can move focus to. */
export const MEETING_CARD_TITLE = "meeting-card-title";

/** The centered card those pages use for a message and its next steps. */
export function MeetingCard({
  title,
  body,
  footer,
  children,
}: {
  title: string;
  body?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={MEETING_CARD_TITLE}
      className="bg-card ring-border flex w-full max-w-[520px] flex-col gap-6 rounded-[20px] p-7 text-center ring-1 sm:p-9"
    >
      <div className="flex flex-col gap-2">
        <h1
          id={MEETING_CARD_TITLE}
          tabIndex={-1}
          className="font-display text-2xl font-bold tracking-tight text-balance outline-none sm:text-3xl"
        >
          {title}
        </h1>
        {body ? (
          <p className="text-muted-foreground text-balance">{body}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap justify-center gap-2.5">{children}</div>
      ) : null}
      {footer ? (
        <p className="text-muted-foreground font-mono text-xs">{footer}</p>
      ) : null}
    </section>
  );
}
