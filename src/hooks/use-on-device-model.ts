"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import {
  modelApi,
  modelLanguage,
  modelState,
  type ModelState,
} from "@/lib/ai/built-in";
import { supports } from "@/lib/capabilities";

/**
 * Whether Chrome's built-in model can make AI notes here, for the reader's language; null
 * until known. Only Chrome on a computer is asked: AI notes name its model, and other
 * Chromium builds can say it downloads without it being theirs to give.
 */
export function useOnDeviceModel(): ModelState | null {
  const locale = useLocale();
  const [state, setState] = useState<ModelState | null>(null);
  useEffect(() => {
    let cancelled = false;
    const asking = supports("onDeviceAi")
      ? modelState(modelApi(), modelLanguage(locale) ?? "en")
      : Promise.resolve<ModelState>("none");
    void asking.then((found) => {
      if (!cancelled) setState(found);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return state;
}
