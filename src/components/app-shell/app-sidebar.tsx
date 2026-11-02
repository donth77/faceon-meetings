"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { publicEnv } from "@/lib/env";

import { AccountMenu, type AccountUser } from "./account-menu";
import {
  isActive,
  PRIMARY_NAV,
  SECONDARY_NAV,
  type NavItem,
} from "./nav-items";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

/**
 * The dashboard sidebar. It collapses to an icon rail (Ctrl/⌘+B or the header button);
 * collapsed, each label shows as a tooltip on hover and keyboard focus.
 */
export function AppSidebar({ user }: { user: AccountUser }) {
  const t = useTranslations("Nav");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
        <Link href="/home" className="rounded-md px-1 py-1.5">
          <Image
            src="/brand/logo-lockup.svg"
            alt={appName}
            width={979}
            height={224}
            className="h-6 w-auto group-data-[collapsible=icon]:hidden dark:hidden"
          />
          <Image
            src="/brand/logo-lockup-dark.svg"
            alt={appName}
            width={979}
            height={224}
            className="hidden h-6 w-auto dark:block dark:group-data-[collapsible=icon]:hidden"
          />
          <Image
            src="/brand/logo-mark.svg"
            alt={appName}
            width={256}
            height={256}
            className="hidden size-6 group-data-[collapsible=icon]:block"
          />
        </Link>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent role="navigation" aria-label={t("label")}>
        <SidebarGroup>
          <NavList items={PRIMARY_NAV} />
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <NavList items={SECONDARY_NAV} />
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavList({ items }: { items: readonly NavItem[] }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              href={href}
              isActive={active}
              tooltip={t(label)}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{t(label)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
