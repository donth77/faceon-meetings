"use client";

import { cn } from "cn";
import {
  Accessibility,
  Bell,
  CalendarDays,
  Mic,
  Settings,
  SmilePlus,
  Sparkles,
  User,
  Video,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, type ReactNode } from "react";

export const SETTINGS_SECTIONS = [
  { slug: "general", key: "general", icon: Settings },
  { slug: "audio", key: "audio", icon: Mic },
  { slug: "video", key: "video", icon: Video },
  { slug: "reactions", key: "reactions", icon: SmilePlus },
  { slug: "notifications", key: "notifications", icon: Bell },
  { slug: "effects", key: "effects", icon: WandSparkles },
  { slug: "calendar", key: "calendar", icon: CalendarDays },
  { slug: "ai-notes", key: "aiNotes", icon: Sparkles },
  { slug: "accessibility", key: "accessibility", icon: Accessibility },
  { slug: "account", key: "account", icon: User },
] as const satisfies ReadonlyArray<{
  slug: string;
  key: string;
  icon: LucideIcon;
}>;

/**
 * The sections of Settings; the current one is marked as the page. A column beside the
 * section on wide screens, a row that scrolls sideways on narrower ones.
 */
export function SettingsNav() {
  const t = useTranslations("Settings");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("sections")}
      className="-m-0.5 flex gap-0.5 overflow-x-auto p-0.5 xl:m-0 xl:flex-[0_0_236px] xl:flex-col xl:overflow-visible xl:p-0"
    >
      {SETTINGS_SECTIONS.map(({ slug, key, icon: Icon }) => {
        // General is Settings' first page.
        const href = slug === "general" ? "/settings" : `/settings/${slug}`;
        const current = pathname.endsWith(href);
        return (
          <Link
            key={slug}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring flex min-h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-[15px] whitespace-nowrap outline-none focus-visible:ring-2",
              current
                ? "bg-card text-foreground font-bold ring-1 ring-[#e2e5ea] dark:ring-white/10"
                : "text-muted-foreground hover:bg-card/60 font-medium",
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
            {t(`section.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Where a settings section renders: its own page, or the meeting's Settings dialog,
 * which titles the section itself and has no room for cards.
 */
export const SettingsChrome = createContext<"page" | "dialog">("page");

/** A section's title (and introduction), on its page. */
export function SectionTitle({
  title,
  intro,
}: {
  title: string;
  intro?: ReactNode;
}) {
  const chrome = use(SettingsChrome);
  if (chrome === "dialog") {
    return intro ? (
      <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
        {intro}
      </p>
    ) : null;
  }
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[22px] font-bold">{title}</h2>
      {intro ? (
        <p className="text-muted-foreground max-w-[64ch] text-[15px] leading-normal">
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/** A settings card: a heading and its rows. In the meeting's dialog, a plain group. */
export function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const chrome = use(SettingsChrome);
  if (chrome === "dialog") {
    return (
      <section className="flex flex-col gap-4 border-t border-white/10 pt-5 first:border-t-0 first:pt-0">
        <h3 className="text-[15px] font-bold">{title}</h3>
        {children}
      </section>
    );
  }
  return (
    <section className="bg-card flex flex-col gap-4 rounded-2xl px-6 py-5.5 ring-1 ring-[#e2e5ea] dark:ring-white/10">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
