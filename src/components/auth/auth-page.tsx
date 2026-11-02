import type { ReactNode } from "react";

import { SiteFooter } from "@/components/marketing/site-footer";
import {
  SiteHeader,
  type HeaderAccountLinks,
} from "@/components/marketing/site-header";

/** Account screens: the public header, a centered column of cards, the public footer. */
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
      <SiteFooter />
    </div>
  );
}
