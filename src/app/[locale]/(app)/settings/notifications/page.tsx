import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelLoading } from "@/components/app-shell/loading";
import { SettingsLoader } from "@/components/settings/settings-loader";
import { requireSession } from "@/lib/auth/session";
import { emailRemindersFor } from "@/lib/reminders/store";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.notifications") };
}

export default function Page() {
  return (
    <Suspense fallback={<PanelLoading height="h-72" />}>
      <Notifications />
    </Suspense>
  );
}

/** Settings → Notifications, with the account's email reminders read from the database. */
async function Notifications() {
  const session = await requireSession("/settings/notifications");
  const reminders = session.user.emailVerified
    ? await emailRemindersFor(session.user.id)
    : null;
  return (
    <SettingsLoader
      section="notifications"
      emailReminders={
        session.user.emailVerified
          ? { minutes: reminders?.minutes ?? 0, email: session.user.email }
          : undefined
      }
    />
  );
}
