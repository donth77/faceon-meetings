import { getTranslations } from "next-intl/server";

import { SettingsCard } from "./settings-nav";

/** A settings section whose features haven't arrived yet. */
export async function ComingSoonSection({
  section,
}: {
  section: "calendar" | "effects" | "aiNotes";
}) {
  const t = await getTranslations(`Settings.${section}`);
  return (
    <>
      <h2 className="text-[22px] font-bold">{t("title")}</h2>
      <SettingsCard title={section === "calendar" ? t("google") : t("title")}>
        <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
          {t("comingSoon")}
        </p>
      </SettingsCard>
    </>
  );
}
