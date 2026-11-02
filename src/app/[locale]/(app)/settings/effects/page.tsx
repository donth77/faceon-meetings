import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ComingSoonSection } from "@/components/settings/coming-soon-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.effects") };
}

export default function Page() {
  return <ComingSoonSection section="effects" />;
}
