import { getTranslations } from "next-intl/server";

import { PageHeader } from "./page-header";

/** Placeholder for dashboard pages that are planned but not built yet. */
export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("Pages");
  return (
    <main className="flex flex-1 flex-col gap-8 p-6 md:p-10">
      <PageHeader title={title} />
      <p className="text-muted-foreground bg-card max-w-xl rounded-xl border p-6">
        {t("comingSoon")}
      </p>
    </main>
  );
}
