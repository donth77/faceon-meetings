import { Suspense, type ReactNode } from "react";

import { AccountLanguage } from "@/components/app-shell/account-language";
import { AppFrame } from "@/components/app-shell/app-frame";
import { requireSession } from "@/lib/auth/session";
import { HOME_ROUTE } from "@/lib/routes";

/** Signed-in pages: sidebar on desktop and tablets, a bottom tab bar on phones. */
export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

async function AppShell({ children }: { children: ReactNode }) {
  const session = await requireSession(HOME_ROUTE);
  return (
    <>
      <AccountLanguage saved={session.user.locale} />
      <AppFrame session={session}>{children}</AppFrame>
    </>
  );
}
