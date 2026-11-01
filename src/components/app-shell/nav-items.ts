import {
  CalendarDays,
  CircleHelp,
  History,
  House,
  Settings,
  Video,
  type LucideIcon,
} from "lucide-react";

import type messages from "../../../messages/en.json";

type NavLabel = keyof (typeof messages)["Nav"];

export type NavItem = { href: string; label: NavLabel; icon: LucideIcon };

/** Main navigation, in sidebar order (also the phone tab bar). */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/home", label: "home", icon: House },
  { href: "/upcoming", label: "upcoming", icon: CalendarDays },
  { href: "/previous", label: "previous", icon: History },
  { href: "/personal-room", label: "personalRoom", icon: Video },
];

/** Near the bottom of the sidebar, above the account row. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/help", label: "help", icon: CircleHelp },
  { href: "/settings", label: "settings", icon: Settings },
];

/** True when `pathname` is the item's page or below it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
