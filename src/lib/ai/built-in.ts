/**
 * The model Chrome carries (Gemini Nano), through the Prompt API: Help's assistant and
 * AI notes use it, on the person's own device.
 */

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

/** The languages the model writes. */
const WRITES = new Set(["en", "es", "ja"]);

/** The browser's model, if it has one. */
export function modelApi(): ModelApi | undefined {
  return (globalThis as { LanguageModel?: ModelApi }).LanguageModel;
}

/** Whether this is Chrome itself, the browser that carries the model. */
function isChrome(): boolean {
  const brands = (
    navigator as { userAgentData?: { brands?: Array<{ brand: string }> } }
  ).userAgentData?.brands;
  return Boolean(brands?.some((b) => b.brand === "Google Chrome"));
}

/** The language the model writes for this locale, or null where it can't. */
export function modelLanguage(locale: string): string | null {
  const language = locale.split("-")[0] ?? locale;
  return WRITES.has(language) ? language : null;
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
  if (!api) return isChrome() ? "update" : "none";
  try {
    const have = await api.availability(optionsFor(language));
    if (have === "available") return "ready";
    // Unavailable may only mean turned off, or not downloaded; Chrome can be told how.
    if (have === "unavailable") return isChrome() ? "enable" : "none";
    return "download";
  } catch {
    return "none";
  }
}
