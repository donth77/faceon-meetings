import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminList } from "@/components/admin/admin-list";
import { AdminRequests } from "@/components/admin/admin-requests";
import { ApprovedHosts } from "@/components/admin/approved-hosts";
import { UsageCard } from "@/components/admin/usage-card";
import { NotFoundContent } from "@/components/app-shell/not-found-content";
import { getSession } from "@/lib/auth/session";
import { adminAddresses, approvedHosts } from "@/lib/hosting/allowlist";
import { answeredRequests, openRequests } from "@/lib/hosting/requests";
import { ASK_AGAIN_AFTER_DAYS } from "@/lib/hosting/rules";
import { fullTerms, isAdmin } from "@/lib/meetings/hosting";
import { requestedPage } from "@/lib/pagination";
import { usageReport } from "@/lib/usage/usage";

/**
 * Moving between a list's pages may wait for the next page: the current one stays on screen
 * (dimmed) until it's ready, rather than every list flashing back to loading.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("title") };
}

/**
 * Settings → Admin: who hosts full meetings, and how much of the free plans is used.
 * Requests to answer, this month's usage (UsageCard; usage warnings link to it), the
 * approved hosts (add an address, or move one back to demos) and who the admins are.
 * Only for admins (ADMIN_EMAILS); for anyone else there's no such page, and Settings
 * doesn't list it. Each list is paged, its page in the address (`?requests=`,
 * `?answers=`, `?hosts=`, `?admins=`); the loading state is in the layout above.
 * Later sections go in as more AdminCards.
 */
export default async function AdminPage({
  searchParams,
}: PageProps<"/[locale]/settings/admin">) {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) {
    return <NotFoundContent heading="h2" />;
  }
  const t = await getTranslations("Admin");
  const query = await searchParams;
  const [requests, answers, hosts, admins, usage] = await Promise.all([
    openRequests(requestedPage(query.requests)),
    answeredRequests(requestedPage(query.answers)),
    approvedHosts(requestedPage(query.hosts)),
    adminAddresses(requestedPage(query.admins)),
    usageReport(),
  ]);
  const iso = (date: Date | null) => date?.toISOString() ?? null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[22px] font-bold">{t("title")}</h2>
        <p className="text-muted-foreground text-[15px]">{t("subtitle")}</p>
      </div>
      <AdminRequests
        requests={requests.rows.map((request) => ({
          ...request,
          createdAt: request.createdAt.toISOString(),
        }))}
        requestsPage={requests.page}
        decisions={answers.rows.map((decision) => ({
          ...decision,
          decidedAt: iso(decision.decidedAt),
        }))}
        decisionsPage={answers.page}
        askAgainDays={ASK_AGAIN_AFTER_DAYS}
      />
      <UsageCard usage={usage} />
      <ApprovedHosts
        hosts={hosts.rows.map((host) => ({
          ...host,
          createdAt: iso(host.createdAt),
        }))}
        page={hosts.page}
        full={fullTerms()}
      />
      <AdminList admins={admins.rows} page={admins.page} />
    </>
  );
}
