import { cn } from "cn";
import { ExternalLink, OctagonAlert, TriangleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { NewTabNote } from "@/components/ui/new-tab-note";
import { publicEnv } from "@/lib/env";
import {
  emailsUsed,
  meterStatus,
  usedShare,
  type MeterStatus,
} from "@/lib/usage/meters";
import type { UsageReport } from "@/lib/usage/usage";

import { AdminCard } from "./admin-card";
import { UsageUpdated } from "./usage-updated";

const STREAM_DASHBOARD = "https://dashboard.getstream.io/";
const NEON_CONSOLE = "https://console.neon.tech/";
const VERCEL_USAGE =
  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fusage&title=Usage";

/**
 * The meter's colors by status: the brand's, then amber and red near and at the limit,
 * each fill on a light track of its own hue (3:1 or more against it, in both themes).
 * The status chip says the same in words, so color is never all there is.
 */
const TRACK: Record<MeterStatus, string> = {
  ok: "bg-brand/15",
  near: "bg-amber-700/15 dark:bg-amber-400/20",
  over: "bg-destructive-fill/15 dark:bg-destructive/20",
};
const FILL: Record<MeterStatus, string> = {
  ok: "bg-brand",
  near: "bg-amber-700 dark:bg-amber-400",
  over: "bg-destructive-fill dark:bg-destructive",
};

function StatusChip({ status }: { status: Exclude<MeterStatus, "ok"> }) {
  const t = useTranslations("Admin.usage");
  const Icon = status === "near" ? TriangleAlert : OctagonAlert;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-xl px-2 text-xs font-bold whitespace-nowrap",
        status === "near"
          ? "bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100"
          : "text-destructive-text bg-destructive-fill/10 dark:bg-destructive/15",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(status)}
    </span>
  );
}

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary focus-visible:focus-ring inline-flex items-center gap-1 self-start rounded text-[13px] font-semibold underline-offset-4 outline-hidden hover:underline"
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
      <NewTabNote />
    </a>
  );
}

/**
 * One meter: its name, a bar of how much of the allowance is used (a meter for screen
 * readers, with the same words as the line below it), and notes. Without a limit
 * there's just the count.
 */
function MeterRow({
  id,
  title,
  used,
  limit,
  value,
  children,
}: {
  id: string;
  title: string;
  used: number;
  limit: number;
  /** The count, in words: "1,234 of 333,000 participant-minutes". */
  value: string;
  children?: ReactNode;
}) {
  const t = useTranslations("Admin.usage");
  const format = useFormatter();
  const share = usedShare(used, limit);
  const status = meterStatus(used, limit);
  const titleId = `usage-${id}`;
  const percent =
    share === null
      ? null
      : share > 0 && share < 0.01
        ? t("underOnePercent")
        : format.number(share, { style: "percent", maximumFractionDigits: 0 });
  return (
    <li className="flex flex-col gap-2 py-4 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 id={titleId} className="font-semibold">
          {title}
        </h4>
        {status === "ok" ? null : <StatusChip status={status} />}
      </div>
      {share === null ? null : (
        <div
          role="meter"
          aria-labelledby={titleId}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={`${value}, ${percent}`}
          className={cn("h-2 overflow-hidden rounded-full", TRACK[status])}
        >
          <div
            className={cn("h-full rounded-full", FILL[status])}
            style={{
              width: `${share > 0 ? Math.max(1, Math.min(100, share * 100)) : 0}%`,
            }}
          />
        </div>
      )}
      <p className="text-sm tabular-nums">
        {value}
        {percent === null ? null : (
          <span className="text-muted-foreground"> · {percent}</span>
        )}
      </p>
      {children}
    </li>
  );
}

/** A note under a meter, in the card's muted text. */
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-[13px] leading-normal">
      {children}
    </p>
  );
}

/**
 * Settings → Admin → Usage this month, the page's last section: how much of each
 * service's free plan this copy has used, so nothing runs out by surprise, each figure
 * with when it was last updated.
 * - Stream: FaceOn's own count of participant-minutes; Stream's API doesn't report what
 *   it bills.
 * - Emails: the whole Resend account's count leads, with FaceOn's share beside it, from
 *   Resend's list of emails where the key can read it, or its answer to FaceOn's last
 *   email (lib/usage/resend.ts, emails.ts).
 * - Neon: compute hours from Neon's API, where it's set up.
 * - Vercel: a link only. Vercel's API has no read-only token, and it warns by email.
 * Figures from other services refresh at most every five minutes while someone looks,
 * and daily in the sweep, which also emails the admins at 80% and 100%
 * (lib/usage/alerts.ts), linking here (#usage).
 */
export function UsageCard({ usage }: { usage: UsageReport }) {
  const t = useTranslations("Admin.usage");
  const format = useFormatter();
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const { stream, emails, neon } = usage;
  const day = (at: Date) =>
    format.dateTime(at, { month: "short", day: "numeric", timeZone: "UTC" });

  const emailRow = (
    id: "emailsToday" | "emailsMonth",
    count: UsageReport["emails"]["today"],
    limit: number,
    more?: ReactNode,
  ) => {
    const used = emailsUsed(count);
    const own = count.sent;
    // The whole Resend account's count leads, with FaceOn's own share beside it; until
    // Resend has said anything, FaceOn's count is all there is.
    const value =
      count.resend === null
        ? limit > 0
          ? t("emailsValue", { used, limit })
          : t("emailsCount", { used })
        : limit > 0
          ? t("emailsAccount", { used, limit, own, appName })
          : t("emailsAccountCount", { used, own, appName });
    return (
      <MeterRow
        id={id}
        title={t(`${id}.title`)}
        used={used}
        limit={limit}
        value={value}
      >
        <Note>
          {count.resend !== null && emails.account ? (
            <UsageUpdated
              at={emails.account.at.toISOString()}
              via={emails.account.via}
            />
          ) : (
            t("emailsOwn", { appName, sent: own })
          )}
        </Note>
        {more}
      </MeterRow>
    );
  };

  return (
    <AdminCard
      id="usage"
      title={t("title")}
      description={t("body", { appName })}
    >
      <ul className="flex flex-col divide-y border-t">
        {stream.configured ? (
          <MeterRow
            id="stream"
            title={t("stream.title")}
            used={stream.minutes}
            limit={stream.limit}
            value={
              stream.limit > 0
                ? t("stream.value", {
                    used: Math.round(stream.minutes),
                    limit: stream.limit,
                  })
                : t("stream.count", { used: Math.round(stream.minutes) })
            }
          >
            <Note>{t("stream.note", { appName })}</Note>
            <Note>
              <UsageUpdated at={stream.countedAt.toISOString()} />
            </Note>
            <OutLink href={STREAM_DASHBOARD}>{t("stream.dashboard")}</OutLink>
          </MeterRow>
        ) : (
          <li className="flex flex-col gap-1 py-4">
            <h4 className="font-semibold">{t("stream.title")}</h4>
            <Note>{t("stream.off")}</Note>
          </li>
        )}

        {emails.configured ? (
          <>
            {emailRow("emailsToday", emails.today, emails.perDay)}
            {emailRow(
              "emailsMonth",
              emails.month,
              emails.perMonth,
              emails.listing === "restricted" ? (
                <Note>{t("emailsKey", { appName })}</Note>
              ) : null,
            )}
          </>
        ) : (
          <li className="flex flex-col gap-1 py-4">
            <h4 className="font-semibold">{t("emailsOff.title")}</h4>
            <Note>{t("emailsOff.body", { appName })}</Note>
          </li>
        )}

        {neon.state === "ok" ? (
          <MeterRow
            id="neon"
            title={t("neon.title")}
            used={neon.cuHours}
            limit={neon.limit}
            value={
              neon.limit > 0
                ? t("neon.value", {
                    used: Math.round(neon.cuHours * 10) / 10,
                    limit: neon.limit,
                  })
                : t("neon.count", { used: Math.round(neon.cuHours * 10) / 10 })
            }
          >
            <Note>
              {neon.periodStart && neon.periodEnd
                ? t("neon.period", {
                    start: day(neon.periodStart),
                    end: day(neon.periodEnd),
                    appName,
                  })
                : t("neon.note", { appName })}
            </Note>
            <Note>
              <UsageUpdated at={neon.readAt.toISOString()} />
            </Note>
          </MeterRow>
        ) : (
          <li className="flex flex-col gap-1.5 py-4">
            <h4 className="font-semibold">{t("neon.title")}</h4>
            <Note>
              {neon.state === "unavailable"
                ? t("neon.unavailable")
                : t("neon.setup", { appName })}
            </Note>
            {neon.state === "unconfigured" ? (
              <OutLink href={NEON_CONSOLE}>{t("neon.console")}</OutLink>
            ) : null}
          </li>
        )}

        <li className="flex flex-col gap-1.5 py-4 last:pb-0">
          <h4 className="font-semibold">{t("vercel.title")}</h4>
          <Note>{t("vercel.body")}</Note>
          <OutLink href={VERCEL_USAGE}>{t("vercel.link")}</OutLink>
        </li>
      </ul>
    </AdminCard>
  );
}
