import {
  CodeXml,
  DoorOpen,
  Languages,
  Monitor,
  MonitorUp,
  TabletSmartphone,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { latestDesktopRelease } from "@/lib/desktop/releases";

type Feature = {
  key:
    | "anyDevice"
    | "screenShare"
    | "safety"
    | "desktopApp"
    | "languages"
    | "openSource";
  icon: LucideIcon;
};

/** The desktop app once it's out (lib/desktop/releases.ts); until then, the languages. */
const features = (desktopApp: boolean): Feature[] => [
  { key: "anyDevice", icon: TabletSmartphone },
  { key: "screenShare", icon: MonitorUp },
  { key: "safety", icon: DoorOpen },
  desktopApp
    ? { key: "desktopApp", icon: Monitor }
    : { key: "languages", icon: Languages },
  { key: "openSource", icon: CodeXml },
];

/** What FaceOn does, below the join card: titles only on phones, with a line each above. */
export async function Features() {
  const t = await getTranslations("Landing");
  const desktopApp = (await latestDesktopRelease()) !== null;

  return (
    <section
      aria-labelledby="features-title"
      className="w-full max-w-[1120px] border-t pt-3.5 sm:pt-10"
    >
      <h2 id="features-title" className="sr-only">
        {t("featuresTitle")}
      </h2>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-x-10 sm:gap-y-7 lg:grid-cols-3">
        {features(desktopApp).map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex min-w-0 items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2"
          >
            <span className="bg-secondary text-primary flex size-8 shrink-0 items-center justify-center rounded-[10px] sm:size-10 sm:rounded-xl">
              <Icon className="size-[18px] sm:size-5" aria-hidden="true" />
            </span>
            <span className="text-sm leading-tight font-semibold sm:hidden">
              {t(`features.${key}.short`)}
            </span>
            <span className="hidden text-base font-bold sm:block">
              {t(`features.${key}.title`)}
            </span>
            <span className="text-muted-foreground hidden text-sm leading-[1.45] sm:block">
              {t(`features.${key}.body`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
