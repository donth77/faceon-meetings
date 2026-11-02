import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { HelpNav, RepoLinks } from "@/components/help/help-center";
import { HelpHeader } from "@/components/help/help-header";
import { HelpHighlights } from "@/components/help/help-highlights";
import { HelpMarkdown } from "@/components/help/help-markdown";
import { NewTabNote } from "@/components/ui/new-tab-note";
import { publicEnv } from "@/lib/env";
import { helpArticles } from "@/lib/help/articles";
import { helpSections } from "@/lib/help/sections";

// Rendered whole before sending, so an address that isn't an article is a real 404.
export const instant = false;

/** The article's heading and text, for the search highlights. */
const TITLE_ID = "help-article-title";
const ARTICLE_ID = "help-article-body";

export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const articles = await helpArticles(params.locale);
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = (await helpArticles(locale)).find((a) => a.slug === slug);
  if (!article) return {};
  return { title: article.title, description: article.summary };
}

/** One help article, with every other article beside it on wide screens. */
export default async function HelpArticlePage({
  params,
}: PageProps<"/[locale]/help/[slug]">) {
  const { locale, slug } = await params;
  const articles = await helpArticles(locale);
  const index = articles.findIndex((article) => article.slug === slug);
  const article = articles[index];
  if (!article) notFound();
  const previous = articles[index - 1];
  const next = articles[index + 1];
  const [t, sections] = await Promise.all([
    getTranslations("Help"),
    helpSections(locale, { withText: true }),
  ]);

  const step =
    "group hover:bg-muted/60 focus-visible:ring-ring flex flex-col gap-1 rounded-xl p-3 ring-1 ring-[#e2e5ea] outline-none focus-visible:ring-2 dark:ring-white/10";
  return (
    <div className="flex w-full max-w-[1120px] flex-1 gap-12 px-5 py-8 sm:px-10 sm:py-10">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-8">
          <HelpNav sections={sections} />
        </div>
      </aside>
      <main className="max-w-[720px] min-w-0 flex-1">
        <div className="mb-8">
          <HelpHeader
            entries={sections.flatMap((section) => section.entries)}
          />
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <nav
            aria-label={t("breadcrumb")}
            className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
          >
            <Link href="/help" className="hover:text-foreground font-medium">
              {t("title")}
            </Link>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span>{t(`categories.${article.category}`)}</span>
          </nav>
          {publicEnv.NEXT_PUBLIC_REPO_URL ? (
            <RepoLinks repoUrl={publicEnv.NEXT_PUBLIC_REPO_URL} />
          ) : null}
        </div>
        {/* Opened from a search: the search highlighted, read in the browser. */}
        <Suspense fallback={null}>
          <HelpHighlights articleId={ARTICLE_ID} titleId={TITLE_ID} />
        </Suspense>
        <article>
          <h1
            id={TITLE_ID}
            tabIndex={-1}
            className="font-display focus-visible:focus-ring rounded-md text-3xl font-bold tracking-tight text-balance outline-hidden sm:text-[34px]"
          >
            {article.title}
          </h1>
          <p className="text-muted-foreground mt-3 text-lg leading-normal">
            {article.summary}
          </p>
          <div id={ARTICLE_ID} className="mt-8">
            <HelpMarkdown markdown={article.body} />
          </div>
        </article>
        <nav
          aria-label={t("moreArticles")}
          className="mt-14 grid gap-3 border-t pt-6 sm:grid-cols-2"
        >
          {previous ? (
            <Link href={`/help/${previous.slug}`} className={step}>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                {t("previousArticle")}
              </span>
              <span className="text-primary font-semibold group-hover:underline">
                {previous.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/help/${next.slug}`}
              className={`${step} sm:items-end sm:text-right`}
            >
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                {t("nextArticle")}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
              <span className="text-primary font-semibold group-hover:underline">
                {next.title}
              </span>
            </Link>
          ) : null}
        </nav>
        {publicEnv.NEXT_PUBLIC_REPO_URL ? (
          <p className="text-muted-foreground mt-10 text-sm">
            {t.rich("stillStuck", {
              link: (chunks) => (
                <a
                  href={`${publicEnv.NEXT_PUBLIC_REPO_URL?.replace(/\/$/, "")}/issues/new/choose`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold underline-offset-4 hover:underline"
                >
                  {chunks}
                  <NewTabNote />
                </a>
              ),
            })}
          </p>
        ) : null}
      </main>
    </div>
  );
}
