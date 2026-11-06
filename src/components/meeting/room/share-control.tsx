"use client";

import {
  AppWindow,
  Monitor,
  MonitorUp,
  MonitorX,
  PanelsTopLeft,
  SquareDashed,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Selection } from "react-aria-components";

import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCapability } from "@/hooks/use-capability";

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
 * tab, a window or the entire screen, with Share sound and Optimize for video, and Part
 * of your screen (Beta), whose area is chosen next. Other browsers go straight to their
 * own picker. While you share, it's Stop sharing.
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
  // Chrome and Edge take hints for their picker and can share sound; elsewhere the
  // browser's own picker opens straight away.
  const options = useCapability("shareOptions");
  const part = useCapability("sharePart");
  const [sound, setSound] = useState(true);
  const [motion, setMotion] = useState(false);

  // Starting or stopping swaps the button for another; if focus was on it (or went to
  // the browser's picker from it), it comes back to the new one (2.4.3).
  const box = useRef<HTMLDivElement>(null);
  const hadFocus = useRef(false);
  useLayoutEffect(() => {
    const lost =
      !document.activeElement || document.activeElement === document.body;
    if (hadFocus.current && lost) box.current?.querySelector("button")?.focus();
  }, [sharing]);
  const frame = (children: ReactNode) => (
    <div
      ref={box}
      data-share-control
      className="flex"
      onFocus={() => {
        hadFocus.current = true;
      }}
      onBlur={(event) => {
        // Focus moving elsewhere on the page; not the button going away.
        const to = event.relatedTarget;
        if (to instanceof Node && !box.current?.contains(to)) {
          hadFocus.current = false;
        }
      }}
    >
      {children}
    </div>
  );

  if (sharing) {
    return frame(
      <ControlButton
        icon={MonitorX}
        label={t("stopSharing")}
        tone="danger"
        onPress={onStop}
      />,
    );
  }
  if (onBlocked || !options) {
    return frame(
      <ControlButton
        icon={MonitorUp}
        label={t("shareScreen")}
        onPress={onBlocked ?? (() => onStart({ audio: false, motion: false }))}
      />,
    );
  }

  const chosen = new Set([
    ...(sound ? ["sound"] : []),
    ...(motion ? ["motion"] : []),
  ]);
  function handleOptions(keys: Selection) {
    const selected = keys === "all" ? new Set(["sound", "motion"]) : keys;
    setSound(selected.has("sound"));
    setMotion(selected.has("motion"));
  }

  return frame(
    <>
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
            {part ? (
              <DropdownMenuItem
                textValue={t("share.part")}
                onAction={() =>
                  onStart({
                    surface: "monitor",
                    part: true,
                    audio: sound,
                    motion,
                  })
                }
                className="py-1.5"
              >
                <SquareDashed aria-hidden="true" />
                <span className="flex flex-col">
                  <span>{t("share.part")}</span>
                  <span className="text-muted-foreground text-xs">
                    {t("share.partHint")}
                  </span>
                </span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup
            aria-label={t("share.options")}
            selectionMode="multiple"
            selectedKeys={chosen}
            onSelectionChange={handleOptions}
          >
            <DropdownMenuItem id="sound">{t("share.sound")}</DropdownMenuItem>
            <DropdownMenuItem id="motion">{t("share.motion")}</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenu>
      </DropdownMenuTrigger>
    </>,
  );
}
