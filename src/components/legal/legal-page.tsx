import { cn } from "cn";
import { getFormatter, getTranslations } from "next-intl/server";

import { HelpMarkdown } from "@/components/help/help-markdown";
import { PUBLIC_CONTAINER } from "@/components/marketing/layout";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import type { LegalDocument } from "@/lib/content/legal";

/** The privacy policy or the terms: a public page anyone can read. */
export async function LegalPage({ document }: { document: LegalDocument }) {
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
          <div className="mt-8">
            <HelpMarkdown markdown={document.body} />
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
