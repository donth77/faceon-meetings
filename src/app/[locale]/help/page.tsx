import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { AppFrame } from "@/components/app-shell/app-frame";
import { HelpCenter } from "@/components/help/help-center";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Help");
  return { title: t("title") };
}

/** Help: inside the app (with the sidebar) when signed in, a public page otherwise. */
export default function HelpPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <HelpFrame>
        <HelpCenter repoUrl={publicEnv.NEXT_PUBLIC_REPO_URL} />
      </HelpFrame>
    </Suspense>
  );
}

async function HelpFrame({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session) return <AppFrame session={session}>{children}</AppFrame>;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex flex-1 justify-center">{children}</div>
      <SiteFooter />
    </div>
  );
}
