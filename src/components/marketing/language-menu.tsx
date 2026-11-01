"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, type Selection } from "react-aria-components";

import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routing } from "@/i18n/routing";

/** next-intl reads the chosen language from this cookie (URLs never carry one). */
const LOCALE_COOKIE = "NEXT_LOCALE";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** A language's name in that language ("Deutsch", "日本語"), capitalized. */
function nativeName(locale: string): string {
  const name =
    new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** The language picker in public page headers. Lists every language the app ships. */
export function LanguageMenu() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const router = useRouter();

  function choose(keys: Selection) {
    const [next] = keys === "all" ? [] : [...keys];
    if (typeof next !== "string" || next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenuTrigger>
      <Button
        aria-label={`${t("language")}: ${nativeName(locale)}`}
        className="border-border bg-card hover:bg-muted focus-visible:ring-ring flex h-10 items-center gap-2 rounded-[10px] border px-2.5 text-sm outline-none focus-visible:ring-2 sm:pr-2.5 sm:pl-3"
      >
        <Globe className="size-[18px]" aria-hidden="true" />
        <span className="max-sm:hidden">{nativeName(locale)}</span>
        <ChevronDown className="size-4 max-sm:hidden" aria-hidden="true" />
      </Button>
      <DropdownMenu placement="bottom end" className="min-w-44">
        <DropdownMenuGroup
          aria-label={t("language")}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[locale]}
          onSelectionChange={choose}
        >
          {routing.locales.map((option) => (
            <DropdownMenuItem key={option} id={option}>
              {nativeName(option)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
