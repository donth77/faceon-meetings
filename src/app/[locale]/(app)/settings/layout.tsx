import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { SettingsNav } from "@/components/settings/settings-nav";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/meetings/hosting";

/** The section list, with Admin for admins: the session streams in after the page. */
async function ViewersSettingsNav() {
  const session = await getSession();
  return <SettingsNav admin={session ? isAdmin(session.user) : false} />;
}

/** Settings: the section list beside the chosen section. */
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("Settings");
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5.5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] font-bold tracking-[-0.01em]">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-[15px]">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:gap-7">
          <Suspense fallback={<SettingsNav />}>
            <ViewersSettingsNav />
          </Suspense>
          <div className="flex min-w-0 flex-col gap-4.5 xl:flex-1">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
