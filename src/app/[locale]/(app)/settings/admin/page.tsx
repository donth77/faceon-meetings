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
 * Settings → Admin: who hosts full meetings. Requests to answer, the approved hosts
 * (add an address, or move one back to demos) and who the admins are. Only for admins
 * (ADMIN_EMAILS); for anyone else there's no such page, and Settings doesn't list it.
 * Later sections (limits, usage against the free credit) go in as more AdminCards.
 */
export default function AdminPage() {
  return (
    <Suspense fallback={<CardsLoading rows={3} />}>
      <Admin />
    </Suspense>
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
    <>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[22px] font-bold">{t("title")}</h2>
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
    </>
  );
}
