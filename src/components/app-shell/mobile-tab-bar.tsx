"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive, PRIMARY_NAV, SECONDARY_NAV } from "./nav-items";

const TABS = [...PRIMARY_NAV, SECONDARY_NAV[1]!];

/** Phones: a bottom tab bar replaces the sidebar (Home, Upcoming, Previous, Room, Settings). */
export function MobileTabBar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      data-tab-bar
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:focus-ring-inset flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] outline-hidden",
                  active
                    ? "text-primary font-bold"
                    : "text-muted-foreground font-medium",
                )}
              >
                {/* The current tab has a pill behind its icon, not just a colour. */}
                <span
                  className={cn(
                    "flex h-6 w-11 items-center justify-center rounded-full",
                    active && "bg-chip text-chip-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="max-w-full truncate">{t(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
