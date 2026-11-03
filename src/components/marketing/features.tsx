import {
  CalendarPlus,
  CodeXml,
  DoorOpen,
  Languages,
  Monitor,
  MonitorUp,
  TabletSmartphone,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";

import { addonAvailable } from "@/lib/addon/google/available";
import { latestDesktopRelease } from "@/lib/desktop/releases";

type Feature = {
  key:
    | "anyDevice"
    | "screenShare"
    | "safety"
    | "desktopApp"
    | "languages"
    | "openSource"
    | "googleWorkspace";
  icon: LucideIcon;
  /** Where to read more: its Help article. */
  href?: string;
};

/**
 * The desktop app once it's out (lib/desktop/releases.ts); until then, the languages.
 * Google Calendar and Gmail where this copy offers the add-on, with how to add it.
 */
const features = (desktopApp: boolean, addon: boolean): Feature[] => [
  { key: "anyDevice", icon: TabletSmartphone },
  { key: "screenShare", icon: MonitorUp },
  { key: "safety", icon: DoorOpen },
  desktopApp
    ? { key: "desktopApp", icon: Monitor }
    : { key: "languages", icon: Languages },
  { key: "openSource", icon: CodeXml },
  ...(addon
    ? [
        {
          key: "googleWorkspace" as const,
          icon: CalendarPlus,
          href: "/help/google-workspace",
        },
      ]
    : []),
];

/** A feature's name, as a link to its Help article when it has one. */
function Title({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return children;
  return (
    <Link
      href={href}
      className="focus-visible:focus-ring rounded-[2px] underline-offset-4 outline-hidden hover:underline"
    >
      {children}
    </Link>
  );
}

/** What FaceOn does, below the join card: titles only on phones, with a line each above. */
export async function Features() {
  const t = await getTranslations("Landing");
  const desktopApp = (await latestDesktopRelease()) !== null;

  return (
    <section
      aria-labelledby="features-title"
      className="w-full max-w-[1120px] border-t pt-3.5 sm:pt-10"
    >
      <h2 id="features-title" className="sr-only">
        {t("featuresTitle")}
      </h2>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-x-10 sm:gap-y-7 lg:grid-cols-3">
        {features(desktopApp, addonAvailable()).map(
          ({ key, icon: Icon, href }) => (
            <li
              key={key}
              className="flex min-w-0 items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2"
            >
              <span className="bg-secondary text-primary flex size-8 shrink-0 items-center justify-center rounded-[10px] sm:size-10 sm:rounded-xl">
                <Icon className="size-[18px] sm:size-5" aria-hidden="true" />
              </span>
              <span className="text-sm leading-tight font-semibold sm:hidden">
                <Title href={href}>{t(`features.${key}.short`)}</Title>
              </span>
              <span className="hidden text-base font-bold sm:block">
                <Title href={href}>{t(`features.${key}.title`)}</Title>
              </span>
              <span className="text-muted-foreground hidden text-sm leading-[1.45] sm:block">
                {t(`features.${key}.body`)}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
