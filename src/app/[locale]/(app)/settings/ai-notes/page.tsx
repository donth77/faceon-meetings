import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SettingsLoader } from "@/components/settings/settings-loader";
import { aiNotesEnabled } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.aiNotes") };
}

export default function Page() {
  if (!aiNotesEnabled) notFound();
  return <SettingsLoader section="aiNotes" />;
}
