import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { Pager } from "@/components/ui/pager";
import { publicEnv } from "@/lib/env";
import type { ListPage } from "@/lib/pagination";

import { AdminCard } from "./admin-card";

/**
 * Settings → Admin → Admins: who the admins are. They come from ADMIN_EMAILS where the app
 * is hosted, so they're only listed here. The list is paged (`?admins=`), and `admins` is
 * the page shown.
 */
export function AdminList({
  admins,
  page,
}: {
  admins: { email: string; hasAccount: boolean }[];
  page: ListPage;
}) {
  const t = useTranslations("Admin");
  return (
    <AdminCard
      title={t("admins.title")}
      description={t("admins.body", {
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
      })}
    >
      <Pager label={t("admins.pages")} param="admins" page={page}>
        <ul className="flex flex-col divide-y border-t">
          {admins.map((admin) => (
            <li
              key={admin.email}
              className="flex flex-col gap-1 py-3.5 last:pb-0"
            >
              <span className="font-medium break-all">{admin.email}</span>
              <span className="text-[13px]">
                <Chip>{admin.hasAccount ? t("account") : t("noAccount")}</Chip>
              </span>
            </li>
          ))}
        </ul>
      </Pager>
    </AdminCard>
  );
}
