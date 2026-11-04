"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import {
  baseLanguage,
  modelApi,
  modelState,
  modelWrites,
  onDeviceNotesLanguage,
  type ModelState,
} from "@/lib/ai/built-in";
import { supports } from "@/lib/capabilities";

/**
 * Whether Chrome's built-in model can make AI notes here, in the language it would write
 * them in (the reader's, or English where it can't write that); null until known. Only
 * Chrome on a computer is asked: AI notes name its model, and other Chromium builds can
 * say it downloads without it being theirs to give.
 */
export function useOnDeviceModel(): ModelState | null {
  const locale = useLocale();
  const [state, setState] = useState<ModelState | null>(null);
  useEffect(() => {
    let cancelled = false;
    const api = modelApi();
    const asking: Promise<ModelState> = supports("onDeviceAi")
      ? modelWrites(api, baseLanguage(locale)).then((writes) =>
          modelState(api, onDeviceNotesLanguage(locale, writes).language),
        )
      : Promise.resolve("none");
    void asking.then((found) => {
      if (!cancelled) setState(found);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return state;
}

/**
 * Whether notes made on this computer would be in English though the reader's language
 * isn't: Chrome's model doesn't write it (yet). False until known, and where Chrome's
 * model isn't offered at all.
 */
export function useOnDeviceNotesInEnglish(): boolean {
  const locale = useLocale();
  const [inEnglish, setInEnglish] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!supports("onDeviceAi")) return;
    void modelWrites(modelApi(), baseLanguage(locale)).then((writes) => {
      if (!cancelled) {
        setInEnglish(onDeviceNotesLanguage(locale, writes).inEnglish);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return inEnglish;
}
