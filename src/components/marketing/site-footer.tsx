import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { GitHubIcon } from "@/components/auth/provider-icons";
import { NewTabNote } from "@/components/ui/new-tab-note";
import { publicEnv } from "@/lib/env";

import { PUBLIC_CONTAINER } from "./layout";

/** Footer for public pages. The source link appears once NEXT_PUBLIC_REPO_URL is set. */
export async function SiteFooter() {
  const t = await getTranslations("Landing");
  const repo = publicEnv.NEXT_PUBLIC_REPO_URL;

  return (
    <footer className="border-t">
      <nav
        aria-label={t("footerLabel")}
        className={cn(
          PUBLIC_CONTAINER,
          "text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 py-6 text-sm",
        )}
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
        <span>
          {t.rich("avatarCredit", {
            link: (chunks) => (
              <a
                href="https://www.dicebear.com/styles/dylan/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline underline-offset-4"
              >
                {chunks}
                <NewTabNote />
              </a>
            ),
          })}
        </span>
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
    </footer>
  );
}
