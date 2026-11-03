import {
  CalendarPlus,
  CodeXml,
  DoorOpen,
  Monitor,
  MonitorDown,
  MonitorUp,
  TabletSmartphone,
  WandSparkles,
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
    | "googleWorkspace"
    | "desktopAndGoogle"
    | "installApp"
    | "effects"
    | "openSource";
  icon: LucideIcon;
  /** Where its name leads: the download, or its Help article. */
  href?: string;
};

const DOWNLOAD = "/download";
const ADDON_HELP = "/help/google-workspace";

/**
 * FaceOn beyond the browser, in one highlight: the desktop app once it's out
 * (lib/desktop/releases.ts), Google Calendar and Gmail where this copy offers the
 * add-on, both, or else installing the web app.
 */
function apps(desktopApp: boolean, addon: boolean): Feature {
  if (desktopApp && addon) return { key: "desktopAndGoogle", icon: Monitor };
  if (desktopApp) return { key: "desktopApp", icon: Monitor, href: DOWNLOAD };
  if (addon) {
    return { key: "googleWorkspace", icon: CalendarPlus, href: ADDON_HELP };
  }
  return { key: "installApp", icon: MonitorDown };
}

/** Always six, so the grid fills: two rows of three, or three of two on phones. */
const features = (desktopApp: boolean, addon: boolean): Feature[] => [
  { key: "anyDevice", icon: TabletSmartphone },
  { key: "screenShare", icon: MonitorUp },
  { key: "safety", icon: DoorOpen },
  apps(desktopApp, addon),
  { key: "effects", icon: WandSparkles },
  { key: "openSource", icon: CodeXml },
];

/** A link inside a feature's line: both places the desktop-and-Google one leads. */
function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-foreground focus-visible:focus-ring rounded-[2px] underline underline-offset-4 outline-hidden"
    >
      {children}
    </Link>
  );
}

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
                {t.rich(`features.${key}.body`, {
                  desktop: (chunks) => (
                    <InlineLink href={DOWNLOAD}>{chunks}</InlineLink>
                  ),
                  google: (chunks) => (
                    <InlineLink href={ADDON_HELP}>{chunks}</InlineLink>
                  ),
                })}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
