import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminCard } from "@/components/admin/admin-card";
import { AdminRequests } from "@/components/admin/admin-requests";
import { ApprovedHosts } from "@/components/admin/approved-hosts";
import { CardsLoading } from "@/components/app-shell/loading";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { approvedHosts } from "@/lib/hosting/allowlist";
import { openRequests, recentDecisions } from "@/lib/hosting/requests";
import { ASK_AGAIN_AFTER_DAYS } from "@/lib/hosting/rules";
import { fullTerms, isAdmin } from "@/lib/meetings/hosting";
import { serverEnv } from "@/lib/server-env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

/**
 * /admin: who hosts full meetings. Requests to answer, the approved hosts (add an
 * address, or move one back to demos) and who the admins are. Only for admins
 * (ADMIN_EMAILS); for anyone else there's no such page. Later sections (limits, usage
 * against the free credit) go in as more AdminCards.
 */
export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10">
      <Suspense fallback={<CardsLoading rows={3} />}>
        <Admin />
      </Suspense>
    </main>
  );
}

async function Admin() {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) notFound();
  const t = await getTranslations("Admin");
  const [requests, decisions, hosts] = await Promise.all([
    openRequests(),
    recentDecisions(),
    approvedHosts(),
  ]);
  const iso = (date: Date | null) => date?.toISOString() ?? null;

  return (
    <div className="flex w-full max-w-[880px] flex-col gap-5.5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold tracking-[-0.01em]">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-[15px]">{t("subtitle")}</p>
      </div>
      <AdminRequests
        requests={requests.map((request) => ({
          ...request,
          createdAt: request.createdAt.toISOString(),
        }))}
        decisions={decisions.map((decision) => ({
          ...decision,
          decidedAt: iso(decision.decidedAt),
        }))}
        askAgainDays={ASK_AGAIN_AFTER_DAYS}
      />
      <ApprovedHosts
        hosts={hosts.map((host) => ({
          ...host,
          createdAt: iso(host.createdAt),
        }))}
        full={fullTerms()}
      />
      <AdminCard title={t("admins.title")}>
        <p className="text-muted-foreground text-[15px] leading-normal">
          {t("admins.body", {
            appName: publicEnv.NEXT_PUBLIC_APP_NAME,
            emails: serverEnv().ADMIN_EMAILS.join(", "),
          })}
        </p>
      </AdminCard>
    </div>
  );
}
