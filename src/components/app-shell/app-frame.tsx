import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import type { Session } from "@/lib/auth/server";
import { avatarUrl } from "@/lib/avatars/seed";
import { isAdmin } from "@/lib/meetings/hosting";

import { AppSidebar } from "./app-sidebar";
import { DesktopSync } from "./desktop-sync";
import { MeetingReminders } from "./meeting-reminders";
import { MobileTabBar } from "./mobile-tab-bar";

/**
 * The signed-in frame: sidebar on desktop and tablets, a bottom tab bar on phones. Used
 * by the dashboard pages and by pages that anyone may open, such as Help.
 */
export async function AppFrame({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  // The sidebar remembers whether it was collapsed (shadcn's sidebar_state cookie).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  const { name, email } = session.user;
  const t = await getTranslations("Nav");

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {/* The first thing Tab reaches: past the sidebar, straight to the page. */}
      <a
        href="#main"
        className="bg-background text-foreground focus:focus-ring sr-only z-[60] rounded-lg px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("skipToMain")}
      </a>
      <AppSidebar
        user={{
          name,
          email,
          image: avatarUrl(session.user),
          admin: isAdmin(session.user),
        }}
      />
      <SidebarInset
        id="main"
        tabIndex={-1}
        className="pb-[calc(4rem+env(safe-area-inset-bottom,0px))] outline-none md:pb-0"
      >
        {children}
      </SidebarInset>
      <MobileTabBar />
      <MeetingReminders />
      <DesktopSync />
      <Toaster position="bottom-center" />
    </SidebarProvider>
  );
}
