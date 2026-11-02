import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HelpIndex } from "@/components/help/help-center";
import { publicEnv } from "@/lib/env";
import { helpSections } from "@/lib/help/sections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Help");
  return { title: t("title") };
}

/** Help's front page: search and every article by category. */
export default async function HelpPage({
  params,
}: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  const sections = await helpSections(locale, { withText: true });
  return (
    <HelpIndex sections={sections} repoUrl={publicEnv.NEXT_PUBLIC_REPO_URL} />
  );
}
