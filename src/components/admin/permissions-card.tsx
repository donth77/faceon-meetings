import { cn } from "cn";
import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { publicEnv } from "@/lib/env";
import type { ProviderPermissions } from "@/lib/media/permissions";

import { AdminCard } from "./admin-card";

type Checked = Exclude<ProviderPermissions["check"]["state"], "off">;

const CHIP: Record<Checked, string> = {
  ok: "bg-emerald-100 text-emerald-950 dark:bg-emerald-400/15 dark:text-emerald-100",
  changed:
    "bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100",
  unknown: "bg-muted text-foreground",
};
const ICON = { ok: CircleCheck, changed: TriangleAlert, unknown: CircleHelp };

/** How a provider's check came out, in words with an icon, so color is never all there is. */
function StateChip({ state }: { state: Checked }) {
  const t = useTranslations("Admin.permissions");
  const Icon = ICON[state];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-xl px-2 text-xs font-bold whitespace-nowrap",
        CHIP[state],
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(state)}
    </span>
  );
}

/**
 * Settings → Admin → Call permissions: whether each video service still lets people's
 * browsers do only what FaceOn set up, so host controls work only through FaceOn, asked
 * as the page loads (lib/media/permissions.ts). The description names the video service
 * (the first, where there's a choice). When the settings change, the daily sweep emails
 * the admins, linking here (#permissions); fixing them is the command shown, run by
 * whoever holds the keys.
 */
export function PermissionsCard({
  providers,
}: {
  providers: ProviderPermissions[];
}) {
  const t = useTranslations("Admin.permissions");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  return (
    <AdminCard
      id="permissions"
      title={t("title")}
      description={t("body", { appName, service: providers[0]?.name ?? "" })}
    >
      <ul className="flex flex-col divide-y border-t">
        {providers.map(({ provider, name, check }) => (
          <li key={provider} className="flex flex-col gap-1.5 py-4 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h4 className="font-semibold">{name}</h4>
              {check.state === "off" ? null : <StateChip state={check.state} />}
            </div>
            <p className="text-muted-foreground text-[13px] leading-normal">
              {check.state === "ok"
                ? t("okNote", { provider: name, appName })
                : check.state === "changed"
                  ? t.rich("changedNote", {
                      provider: name,
                      appName,
                      command: check.fix,
                      code: (chunks) => (
                        <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[12px] whitespace-nowrap">
                          {chunks}
                        </code>
                      ),
                    })
                  : check.state === "unknown"
                    ? t("unknownNote", { provider: name })
                    : t("off", { provider: name })}
            </p>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}
