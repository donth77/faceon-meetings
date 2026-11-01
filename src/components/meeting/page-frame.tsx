import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoLockup } from "@/components/brand/logo-lockup";
import { LanguageMenu } from "@/components/marketing/language-menu";
import { PUBLIC_CONTAINER } from "@/components/marketing/layout";

import { SignInLink } from "./sign-in-link";

/**
 * Pages around a meeting (pre-join, notices, after leaving): the public header's logo
 * and language menu (plus Sign in for guests), content centered.
 */
export function MeetingPageFrame({
  signInHref,
  children,
}: {
  /** Shown to guests, returning them here after signing in. */
  signInHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={cn(
          PUBLIC_CONTAINER,
          "flex min-h-18 items-center justify-between gap-3 py-4",
        )}
      >
        <Link href="/" className="inline-flex shrink-0 rounded-md">
          <LogoLockup className="h-7 sm:h-[30px]" />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <LanguageMenu />
          {signInHref ? <SignInLink href={signInHref} /> : null}
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-14 sm:px-10">
        {children}
      </main>
    </div>
  );
}

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
      aria-labelledby="meeting-card-title"
      className="bg-card ring-border flex w-full max-w-[520px] flex-col gap-6 rounded-[20px] p-7 text-center ring-1 sm:p-9"
    >
      <div className="flex flex-col gap-2">
        <h1
          id="meeting-card-title"
          className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl"
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
