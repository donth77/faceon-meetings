"use client";

import {
  AppWindow,
  Monitor,
  MonitorUp,
  MonitorX,
  PanelsTopLeft,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Selection } from "react-aria-components";

import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isChromium } from "@/lib/platform";

import type { ShareOptions } from "../media";
import { ControlButton } from "./control-button";

type Surface = NonNullable<ShareOptions["surface"]>;

const SURFACES: Array<{ surface: Surface; icon: typeof AppWindow }> = [
  { surface: "browser", icon: AppWindow },
  { surface: "window", icon: PanelsTopLeft },
  { surface: "monitor", icon: Monitor },
];

/**
 * Share screen, as in Meet: in Chrome and Edge a menu opens the browser's picker on a
 * tab, a window or the entire screen, with Share sound and Optimize for video. Other
 * browsers go straight to their own picker. While you share, it's Stop sharing.
 */
export function ShareControl({
  sharing,
  onBlocked,
  onStart,
  onStop,
}: {
  sharing: boolean;
  /** Says why you can't share right now, in place of the menu; null when you can. */
  onBlocked: (() => void) | null;
  onStart: (options: ShareOptions) => void;
  onStop: () => void;
}) {
  const t = useTranslations("Meeting");
  const [sound, setSound] = useState(true);
  const [motion, setMotion] = useState(false);

  if (sharing) {
    return (
      <div className="flex">
        <ControlButton
          icon={MonitorX}
          label={t("stopSharing")}
          tone="danger"
          onPress={onStop}
        />
      </div>
    );
  }
  if (onBlocked || !isChromium()) {
    return (
      <div className="flex">
        <ControlButton
          icon={MonitorUp}
          label={t("shareScreen")}
          onPress={
            onBlocked ?? (() => onStart({ audio: false, motion: false }))
          }
        />
      </div>
    );
  }

  const options = new Set([
    ...(sound ? ["sound"] : []),
    ...(motion ? ["motion"] : []),
  ]);
  function handleOptions(keys: Selection) {
    const selected = keys === "all" ? new Set(["sound", "motion"]) : keys;
    setSound(selected.has("sound"));
    setMotion(selected.has("motion"));
  }

  return (
    <div className="flex">
      <DropdownMenuTrigger>
        <ControlButton icon={MonitorUp} label={t("shareScreen")} />
        <DropdownMenu placement="top" className="min-w-64">
          <DropdownMenuGroup aria-label={t("share.what")}>
            {SURFACES.map(({ surface, icon: Icon }) => (
              <DropdownMenuItem
                key={surface}
                textValue={t(`share.${surface}`)}
                onAction={() => onStart({ surface, audio: sound, motion })}
                className="py-1.5"
              >
                <Icon aria-hidden="true" />
                <span className="flex flex-col">
                  <span>{t(`share.${surface}`)}</span>
                  {surface === "browser" ? (
                    <span className="text-muted-foreground text-xs">
                      {t("share.browserHint")}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup
            aria-label={t("share.options")}
            selectionMode="multiple"
            selectedKeys={options}
            onSelectionChange={handleOptions}
          >
            <DropdownMenuItem id="sound">{t("share.sound")}</DropdownMenuItem>
            <DropdownMenuItem id="motion">{t("share.motion")}</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenu>
      </DropdownMenuTrigger>
    </div>
  );
}
