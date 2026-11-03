import type { ReactNode } from "react";

import { WakeOnIntent } from "@/components/app-shell/wake-on-intent";
import { HideInDesktopApp } from "@/components/desktop/hide-in-desktop-app";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  SiteHeader,
  type HeaderAccountLinks,
} from "@/components/marketing/site-header";
import { wakesDatabase } from "@/lib/db/wake";

/**
 * Account screens: the public header, a centered column of cards, the public footer
 * (not in the desktop app). Short windows, like the app's first one, get less padding.
 */
export function AuthPage({
  links,
  children,
}: {
  links: HeaderAccountLinks;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader links={links} />
      <main className="flex flex-1 items-center justify-center px-5 pt-4 pb-16 sm:px-10 [@media(max-height:820px)]:pt-2 [@media(max-height:820px)]:pb-4">
        <div className="flex w-full max-w-[460px] flex-col gap-5">
          {children}
        </div>
      </main>
      <HideInDesktopApp>
        <SiteFooter />
      </HideInDesktopApp>
      {/* Signing in, signing up and resetting a password all need the database next. */}
      {wakesDatabase() ? <WakeOnIntent /> : null}
    </div>
  );
}
