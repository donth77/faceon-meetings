/**
 * The model Chrome carries (Gemini Nano), through the Prompt API: Help's assistant and
 * AI notes use it, on the person's own device.
 */

import { supports } from "@/lib/capabilities";

/** What of the Prompt API this uses. It isn't in TypeScript's lib yet. */
export interface ModelSession {
  prompt(
    input: string,
    options?: { responseConstraint?: object; signal?: AbortSignal },
  ): Promise<string>;
  promptStreaming(input: string): ReadableStream<string>;
  /** How much the session can take in, in tokens. */
  readonly inputQuota?: number;
  destroy(): void;
}
export interface ModelOptions {
  expectedInputs: Array<{ type: "text"; languages: string[] }>;
  expectedOutputs: Array<{ type: "text"; languages: string[] }>;
  initialPrompts?: Array<{ role: "system"; content: string }>;
  monitor?: (monitor: EventTarget) => void;
  signal?: AbortSignal;
}
export interface ModelApi {
  availability(
    options: Pick<ModelOptions, "expectedInputs" | "expectedOutputs">,
  ): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  create(options: ModelOptions): Promise<ModelSession>;
}

/** Where to read about the model and what it needs. */
export const ABOUT_MODEL = "https://developer.chrome.com/docs/ai/built-in";

/**
 * The languages Chrome documents the model writing, for when the model can't be asked:
 * https://developer.chrome.com/docs/ai/prompt-api (more are on the way).
 */
const WRITES = new Set(["en", "es", "ja", "de", "fr"]);

/** The browser's model, if it has one. */
export function modelApi(): ModelApi | undefined {
  return (globalThis as { LanguageModel?: ModelApi }).LanguageModel;
}

/** A locale's language as the model names languages: "pt" for pt-BR. */
export const baseLanguage = (locale: string): string =>
  (locale.split("-")[0] ?? locale).toLowerCase();

/** The language the model writes for this locale, or null where Chrome says it can't. */
export function modelLanguage(locale: string): string | null {
  const language = baseLanguage(locale);
  return WRITES.has(language) ? language : null;
}

/**
 * Whether the model writes this language. The model is asked where it's here, since
 * Chrome adds languages over time: unavailable for this language while not for English
 * means it can't. Where it can't say (no model here at all), Chrome's documented list.
 */
export async function modelWrites(
  api: ModelApi | undefined,
  language: string,
): Promise<boolean> {
  if (language === "en") return true;
  if (typeof api?.availability === "function") {
    try {
      const [own, english] = await Promise.all([
        api.availability(optionsFor(language)),
        api.availability(optionsFor("en")),
      ]);
      if (own !== "unavailable") return true;
      if (english !== "unavailable") return false;
    } catch {
      // Asking failed: go by the documented list.
    }
  }
  return WRITES.has(language);
}

/**
 * The language notes made on this computer are written in: the person's own where the
 * model writes it, else English. `inEnglish` says when that isn't the person's language.
 */
export function onDeviceNotesLanguage(
  locale: string,
  writes: boolean,
): { language: string; inEnglish: boolean } {
  const language = baseLanguage(locale);
  if (writes || language === "en") return { language, inEnglish: false };
  return { language: "en", inEnglish: true };
}

export const optionsFor = (
  language: string,
): Pick<ModelOptions, "expectedInputs" | "expectedOutputs"> => ({
  expectedInputs: [{ type: "text", languages: [...new Set(["en", language])] }],
  expectedOutputs: [{ type: "text", languages: [language] }],
});

/**
 * Whether the model can be used here: ready; after a download (which the person
 * starts); after updating Chrome; after turning it on in Chrome; or not in this browser.
 */
export type ModelState = "ready" | "download" | "update" | "enable" | "none";

export async function modelState(
  api: ModelApi | undefined,
  language: string,
): Promise<ModelState> {
  // Chrome on a computer carries the model, so there it's a matter of updating or
  // turning it on; anywhere else, it isn't there to be had.
  if (!api) return supports("onDeviceAi") ? "update" : "none";
  try {
    const have = await api.availability(optionsFor(language));
    if (have === "available") return "ready";
    // Unavailable may only mean turned off, or not downloaded; Chrome can be told how.
    if (have === "unavailable") {
      return supports("onDeviceAi") ? "enable" : "none";
    }
    return "download";
  } catch {
    return "none";
  }
}
