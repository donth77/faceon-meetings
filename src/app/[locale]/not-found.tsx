import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NotFoundContent } from "@/components/app-shell/not-found-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("title") };
}

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <NotFoundContent />
    </main>
  );
}
