import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { MobileTabBar } from "@/components/app-shell/mobile-tab-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
  const [session, cookieStore] = await Promise.all([
    requireSession(HOME_ROUTE),
    cookies(),
  ]);
  // The sidebar remembers whether it was collapsed (shadcn's sidebar_state cookie).
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const { name, email, image } = session.user;

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar user={{ name, email, image }} />
      <SidebarInset className="pb-16 md:pb-0">{children}</SidebarInset>
      <MobileTabBar />
    </SidebarProvider>
  );
}
