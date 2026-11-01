import {
  CodeXml,
  Globe,
  Languages,
  MonitorUp,
  ShieldCheck,
  TabletSmartphone,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

const FEATURES: ReadonlyArray<{
  key:
    | "noDownloads"
    | "anyDevice"
    | "screenShare"
    | "safety"
    | "languages"
    | "openSource";
  icon: LucideIcon;
}> = [
  { key: "noDownloads", icon: Globe },
  { key: "anyDevice", icon: TabletSmartphone },
  { key: "screenShare", icon: MonitorUp },
  { key: "safety", icon: ShieldCheck },
  { key: "languages", icon: Languages },
  { key: "openSource", icon: CodeXml },
];

export async function Features() {
  const t = await getTranslations("Landing");

  return (
    <section
      aria-labelledby="features-title"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6"
    >
      <h2
        id="features-title"
        className="font-display mb-8 text-2xl font-bold text-balance"
      >
        {t("featuresTitle")}
      </h2>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon: Icon }) => (
          <li key={key} className="bg-card flex gap-4 rounded-2xl border p-5">
            <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-semibold">
                {t(`features.${key}.title`)}
              </span>
              <span className="text-muted-foreground text-sm">
                {t(`features.${key}.body`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
