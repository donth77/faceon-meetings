import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { GitHubIcon } from "@/components/auth/provider-icons";
import { NewTabNote } from "@/components/ui/new-tab-note";
import { publicEnv } from "@/lib/env";

import { PUBLIC_CONTAINER } from "./layout";

/**
 * Footer for public pages: Help, the legal pages and the credits. The source link
 * appears once NEXT_PUBLIC_REPO_URL is set. The language menu is in the header.
 */
export async function SiteFooter() {
  const t = await getTranslations("Landing");
  const repo = publicEnv.NEXT_PUBLIC_REPO_URL;

  return (
    <footer className="border-t">
      <div
        className={cn(
          PUBLIC_CONTAINER,
          "flex justify-center py-5 sm:justify-start",
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
      </div>
    </footer>
  );
}
