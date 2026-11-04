import { cn } from "cn";
import { Languages } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { HelpMarkdown } from "@/components/help/help-markdown";
import { PUBLIC_CONTAINER } from "@/components/marketing/layout";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import type { LegalDocument } from "@/lib/content/legal";

/**
 * The privacy policy, the terms or the credits: a public page anyone can read. A
 * translation of a document that binds (the policy and the terms) says so, and links to
 * the English version, which is the one that applies.
 */
export async function LegalPage({
  document,
  path,
  binding,
}: {
  document: LegalDocument;
  /** The page's address, for the link to its English version. */
  path: string;
  binding: boolean;
}) {
  const t = await getTranslations("Legal");
  const format = await getFormatter();
  const updated = document.updated
    ? format.dateTime(new Date(`${document.updated}T12:00:00Z`), {
        dateStyle: "long",
        timeZone: "UTC",
      })
    : null;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main
        className={cn(
          PUBLIC_CONTAINER,
          "flex flex-1 justify-center py-8 sm:py-12",
        )}
      >
        <article className="w-full max-w-[720px]">
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {document.title}
          </h1>
          {updated ? (
            <p className="text-muted-foreground mt-3 text-sm">
              {t("updated", { date: updated })}
            </p>
          ) : null}
          {document.translated && binding ? (
            <p className="bg-muted mt-6 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-normal">
              <Languages
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                {t.rich("translated", {
                  english: (chunks) => (
                    <a
                      href={`${path}?hl=en`}
                      hrefLang="en"
                      className="text-primary focus-visible:focus-ring rounded-[2px] font-semibold underline underline-offset-4 outline-hidden"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </span>
            </p>
          ) : null}
          <div className="mt-8">
            <HelpMarkdown markdown={document.body} />
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
