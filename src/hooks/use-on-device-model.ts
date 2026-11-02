"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import {
  modelApi,
  modelLanguage,
  modelState,
  type ModelState,
} from "@/lib/ai/built-in";

/** Whether Chrome's built-in model works here, for the reader's language; null until known. */
export function useOnDeviceModel(): ModelState | null {
  const locale = useLocale();
  const [state, setState] = useState<ModelState | null>(null);
  useEffect(() => {
    let cancelled = false;
    void modelState(modelApi(), modelLanguage(locale) ?? "en").then((found) => {
      if (!cancelled) setState(found);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return state;
}
