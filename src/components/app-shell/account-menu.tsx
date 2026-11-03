"use client";

import {
  ChevronsUpDown,
  Keyboard,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { Selection } from "react-aria-components";
import { toast } from "sonner";

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
import { useCapability } from "@/hooks/use-capability";
import { signOut } from "@/lib/auth/client";
import { isDesktopApp } from "@/lib/desktop/use-desktop";
import { DESKTOP_WELCOME_ROUTE } from "@/lib/routes";

import { UserAvatar } from "./user-avatar";

export type AccountUser = {
  name: string;
  email: string;
  image?: string | null;
  /** An admin (ADMIN_EMAILS): the menu links to Settings → Admin. */
  admin?: boolean;
};

const THEMES = ["system", "light", "dark"] as const;

/**
 * The account row at the bottom of the sidebar, with Profile, Admin (for admins), Theme,
 * Install app (where the browser offers it), Keyboard shortcuts (with a keyboard) and
 * Sign out.
 */
export function AccountMenu({ user }: { user: AccountUser }) {
  const t = useTranslations("Account");
  const { theme = "system", setTheme } = useTheme();
  const openShortcuts = useOpenShortcuts();
  const keyboard = useCapability("keyboard");

  // Feedback at once, then a full load, so nothing from the session stays in memory. The
  // page can't change first: only the server can clear the sign-in cookie, and until it
  // has, the landing page would send you back to Home.
  async function handleSignOut() {
    toast.loading(t("signingOut"));
    try {
      await signOut();
    } finally {
      window.location.replace(isDesktopApp() ? DESKTOP_WELCOME_ROUTE : "/");
    }
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
        className="data-[pressed]:bg-sidebar-accent"
      >
        <UserAvatar name={user.name} image={user.image} className="size-8" />
        <span className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{user.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {user.email}
          </span>
        </span>
        {/* Named by what it shows, then what it is (WCAG 2.5.3, label in name). */}
        <span className="sr-only">{t("menuLabel")}</span>
        <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
      </SidebarMenuButton>
      <DropdownMenu placement="top start" className="min-w-56">
        <DropdownMenuItem href="/settings/account">
          <UserRound aria-hidden="true" />
          {t("profile")}
        </DropdownMenuItem>
        {user.admin ? (
          <DropdownMenuItem href="/settings/admin">
            <ShieldCheck aria-hidden="true" />
            {t("admin")}
          </DropdownMenuItem>
        ) : null}
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
        {keyboard ? (
          <DropdownMenuItem onAction={openShortcuts}>
            <Keyboard aria-hidden="true" />
            {t("shortcuts")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onAction={handleSignOut}>
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
