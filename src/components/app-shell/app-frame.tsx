import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import type { Session } from "@/lib/auth/server";
import { avatarUrl } from "@/lib/avatars/seed";

import { AppSidebar } from "./app-sidebar";
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

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar user={{ name, email, image: avatarUrl(session.user) }} />
      <SidebarInset className="pb-16 md:pb-0">{children}</SidebarInset>
      <MobileTabBar />
      <MeetingReminders />
      <Toaster position="bottom-center" />
    </SidebarProvider>
  );
}
