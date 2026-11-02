"use client";

import { cn } from "cn";
import { ChevronRight, ExternalLink, Keyboard } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { GitHubIcon } from "@/components/auth/provider-icons";
import { useOpenShortcuts } from "@/components/shortcuts/shortcuts-dialog";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import type { HelpEntry, HelpSection } from "@/lib/help/sections";

import { HelpHeader } from "./help-header";

function EntryLink({ entry }: { entry: HelpEntry }) {
  return (
    <Link
      href={`/help/${entry.slug}`}
      className="group hover:bg-muted/60 focus-visible:ring-ring -mx-3 flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-2"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-primary font-semibold group-hover:underline">
          {entry.title}
        </span>
        <span className="text-muted-foreground text-sm leading-normal">
          {entry.summary}
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * Help's front page: search across every article, the articles by category, the
 * keyboard shortcuts, and where to report a problem.
 */
export function HelpIndex({
  sections,
  repoUrl,
}: {
  sections: HelpSection[];
  repoUrl?: string | undefined;
}) {
  const t = useTranslations("Help");
  const openShortcuts = useOpenShortcuts();

  return (
    <main className="flex w-full max-w-[860px] flex-1 flex-col gap-9 px-5 py-8 sm:px-10 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
          </p>
        </div>
        {repoUrl ? <RepoLinks repoUrl={repoUrl} /> : null}
      </div>

      <HelpHeader entries={sections.flatMap((section) => section.entries)} />

      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {sections.map((section) => (
          <section
            key={section.id}
            aria-labelledby={`help-${section.id}`}
            className="flex flex-col gap-1"
          >
            <h2 id={`help-${section.id}`} className="mb-1 text-lg font-bold">
              {section.name}
            </h2>
            {section.entries.map((entry) => (
              <EntryLink key={entry.slug} entry={entry} />
            ))}
          </section>
        ))}
      </div>

      <section
        aria-labelledby="help-shortcuts"
        className="bg-card ring-border flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 ring-1"
      >
        <div className="flex items-start gap-3">
          <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Keyboard className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="help-shortcuts" className="font-semibold">
              {t("shortcutsTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t.rich("shortcutsBody", {
                key: (chunks) => (
                  <kbd className="bg-muted rounded border px-1.5 font-sans text-xs font-semibold">
                    {chunks}
                  </kbd>
                ),
              })}
            </p>
          </div>
        </div>
        <Button variant="outline" size="lg" onPress={openShortcuts}>
          <Keyboard aria-hidden="true" />
          {t("showShortcuts")}
        </Button>
      </section>
    </main>
  );
}

/** Report an issue and View source on GitHub, at the top right of every Help page. */
export function RepoLinks({ repoUrl }: { repoUrl: string }) {
  const t = useTranslations("Help");
  const repo = repoUrl.replace(/\/$/, "");
  return (
    <div className="flex shrink-0 items-center gap-1">
      <a
        href={`${repo}/issues/new/choose`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold outline-none focus-visible:ring-2"
      >
        {t("reportIssueShort")}
        <ExternalLink className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{t("opensInNewTab")}</span>
      </a>
      <a
        href={repo}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("viewSource")}
        title={t("viewSource")}
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
      >
        <GitHubIcon className="size-5" />
      </a>
    </div>
  );
}

/** Every article by category, beside an article; the one you're reading is marked. */
export function HelpNav({ sections }: { sections: HelpSection[] }) {
  const t = useTranslations("Help");
  const pathname = usePathname();
  return (
    <nav aria-label={t("topics")} className="flex flex-col gap-5">
      <Link
        href="/help"
        className="text-muted-foreground hover:text-foreground text-sm font-semibold"
      >
        {t("allTopics")}
      </Link>
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          <span className="text-muted-foreground mb-1 text-xs font-bold tracking-[0.06em] uppercase">
            {section.name}
          </span>
          {section.entries.map((entry) => {
            const current = pathname.endsWith(`/help/${entry.slug}`);
            return (
              <Link
                key={entry.slug}
                href={`/help/${entry.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring -mx-2 rounded-lg px-2 py-1.5 text-sm outline-none focus-visible:ring-2",
                  current
                    ? "bg-secondary text-primary font-semibold"
                    : "hover:bg-muted/60",
                )}
              >
                {entry.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
