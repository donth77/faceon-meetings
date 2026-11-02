import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SettingsLoader } from "@/components/settings/settings-loader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.notifications") };
}

export default function Page() {
  return <SettingsLoader section="notifications" />;
}
