"use client";

import { ChevronsUpDown, Keyboard, LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import type { Selection } from "react-aria-components";

import { InstallMenuItem } from "@/components/pwa/install-app";
import { useOpenShortcuts } from "@/components/shortcuts/shortcuts-dialog";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth/client";

import { UserAvatar } from "./user-avatar";

export type AccountUser = {
  name: string;
  email: string;
  image?: string | null;
};

const THEMES = ["system", "light", "dark"] as const;

/**
 * The account row at the bottom of the sidebar, with Profile, Theme, Install app (where
 * the browser offers it), Keyboard shortcuts and Sign out.
 */
export function AccountMenu({ user }: { user: AccountUser }) {
  const t = useTranslations("Account");
  const router = useRouter();
  const { theme = "system", setTheme } = useTheme();
  const openShortcuts = useOpenShortcuts();

  async function handleSignOut() {
    await signOut();
    router.replace("/");
    router.refresh();
  }

  function handleTheme(keys: Selection) {
    const [next] = keys === "all" ? [] : [...keys];
    if (typeof next === "string") setTheme(next);
  }

  return (
    <DropdownMenuTrigger>
      <SidebarMenuButton
        size="lg"
        tooltip={user.name}
        aria-label={t("menuLabel", { name: user.name })}
        className="data-[pressed]:bg-sidebar-accent"
      >
        <UserAvatar name={user.name} image={user.image} className="size-8" />
        <span className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{user.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {user.email}
          </span>
        </span>
        <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
      </SidebarMenuButton>
      <DropdownMenu placement="top start" className="min-w-56">
        <DropdownMenuItem href="/settings/account">
          <UserRound aria-hidden="true" />
          {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup
          aria-label={t("theme")}
          selectionMode="single"
          selectedKeys={[theme]}
          onSelectionChange={handleTheme}
        >
          <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
          {THEMES.map((option) => (
            <DropdownMenuItem key={option} id={option}>
              {t(`themes.${option}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <InstallMenuItem />
        <DropdownMenuItem onAction={openShortcuts}>
          <Keyboard aria-hidden="true" />
          {t("shortcuts")}
        </DropdownMenuItem>
        <DropdownMenuItem onAction={handleSignOut}>
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
