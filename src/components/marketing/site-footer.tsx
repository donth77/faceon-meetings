import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { GitHubIcon } from "@/components/auth/provider-icons";
import { NewTabNote } from "@/components/ui/new-tab-note";
import { publicEnv } from "@/lib/env";

import { LanguageMenu } from "./language-menu";
import { PUBLIC_CONTAINER } from "./layout";

/**
 * Footer for public pages: Help, the legal pages and the credits, and the language menu.
 * The source link appears once NEXT_PUBLIC_REPO_URL is set.
 */
export async function SiteFooter() {
  const t = await getTranslations("Landing");
  const repo = publicEnv.NEXT_PUBLIC_REPO_URL;

  return (
    <footer className="border-t">
      <div
        className={cn(
          PUBLIC_CONTAINER,
          "flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-5 sm:justify-between",
        )}
      >
        <nav
          aria-label={t("footerLabel")}
          className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm"
        >
          <Link href="/help" className="hover:text-foreground">
            {t("help")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t("terms")}
          </Link>
          <Link href="/credits" className="hover:text-foreground">
            {t("credits")}
          </Link>
          {repo ? (
            <a
              href={repo}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1.5"
            >
              <GitHubIcon className="size-4" />
              {t("viewSource")}
              <NewTabNote />
            </a>
          ) : null}
        </nav>
        {/* Phones have it in the header, beside Sign in. */}
        <div className="hidden sm:block">
          <LanguageMenu />
        </div>
      </div>
    </footer>
  );
}
