"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { EffectsProblem } from "@/lib/effects/camera-effects";
import { savePreferences } from "@/lib/preferences";

/**
 * What a preview outside a meeting (pre-join, Settings) does when an effect can't keep
 * up or can't run: turn it off and say why, or go back to the background that's showing.
 */
export function useEffectProblems(): (problem: EffectsProblem) => void {
  const t = useTranslations("Effects");
  return (problem) => {
    if (problem.kind === "backgroundFailed") {
      savePreferences({ effect: problem.showing });
      toast(t("backgroundFailed"));
      return;
    }
    savePreferences({ effect: undefined });
    toast(t(problem.kind === "tooSlow" ? "tooSlow" : "previewFailed"));
  };
}
