import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/app-shell/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("previous") };
}

export default async function Page() {
  const t = await getTranslations("Pages");
  return <ComingSoon title={t("previous")} />;
}
