"use client";

import { useTranslations } from "next-intl";
import { Button as AriaButton } from "react-aria-components";

import type { DeviceProblem } from "@/lib/device/problems";
import { publicEnv } from "@/lib/env";

/**
 * Why the camera or microphone didn't start, and what to do, with Try again where trying
 * again can help (not where the browser can't use them at all).
 */
export function DeviceProblemNote({
  device,
  problem,
  onRetry,
}: {
  device: "microphone" | "camera";
  problem: DeviceProblem;
  onRetry: () => void;
}) {
  const t = useTranslations("DeviceProblems");
  const tp = useTranslations("PreJoin");
  return (
    <p role="alert" className="text-sm">
      {t(`${device}.${problem}`, { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
      {problem === "unsupported" ? null : (
        <>
          {" "}
          <AriaButton
            onPress={onRetry}
            className="text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline"
          >
            {tp("tryAgain")}
          </AriaButton>
        </>
      )}
    </p>
  );
}
