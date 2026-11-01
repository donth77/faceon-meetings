import type { ReactNode } from "react";

import {
  SiteHeader,
  type HeaderAccountLinks,
} from "@/components/marketing/site-header";

/** Account screens: the public header, then a centered column of cards. */
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
      <main className="flex flex-1 items-center justify-center px-5 pt-4 pb-16 sm:px-10">
        <div className="flex w-full max-w-[460px] flex-col gap-5">
          {children}
        </div>
      </main>
    </div>
  );
}
