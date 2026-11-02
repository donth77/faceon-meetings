"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";

import {
  effectiveNoiseSuppression,
  type NoiseSuppression,
} from "@/lib/noise/noise";
import {
  strongAvailable,
  subscribeStrong,
  takeFailureNotice,
} from "@/lib/noise/support";
import { usePreferences, withDefaults } from "@/lib/preferences";

/**
 * Noise suppression as chosen (Settings → Audio) and as it runs: strong falls back to
 * standard where this browser can't run it, or once it has failed during this visit,
 * which is said once.
 */
export function useNoiseSuppression(): {
  chosen: NoiseSuppression;
  mode: NoiseSuppression;
  strongAvailable: boolean;
} {
  const t = useTranslations("Settings.audio");
  const chosen = withDefaults(usePreferences()).noiseSuppression;
  const available = useSyncExternalStore(
    subscribeStrong,
    strongAvailable,
    () => false,
  );
  useEffect(() => {
    if (!available && takeFailureNotice()) toast(t("noiseStrongFailed"));
  }, [available, t]);
  return {
    chosen,
    mode: effectiveNoiseSuppression(chosen, available),
    strongAvailable: available,
  };
}
