import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { GitHubIcon } from "@/components/auth/provider-icons";
import { publicEnv } from "@/lib/env";

/** Footer for public pages. The source link appears once NEXT_PUBLIC_REPO_URL is set. */
export async function SiteFooter() {
  const t = await getTranslations("Landing");
  const repo = publicEnv.NEXT_PUBLIC_REPO_URL;

  return (
    <footer className="border-t">
      <nav
        aria-label={t("footerLabel")}
        className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm sm:px-6"
      >
        <Link href="/help" className="hover:text-foreground">
          {t("help")}
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
          </a>
        ) : null}
      </nav>
    </footer>
  );
}
