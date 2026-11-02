/**
 * Speech to text on the speaker's own device, for AI notes: the Web Speech API with
 * `processLocally`, so audio never leaves the device (Chrome 139 and later). Each
 * person's browser transcribes only their own mic, and only while they're unmuted.
 */

import type { TranscriptionStatus } from "@/lib/meetings/events";

/** What of the Web Speech API this uses. It isn't in TypeScript's lib. */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative | undefined;
}
interface RecognitionResultEvent extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: RecognitionResult | undefined;
  };
}
interface RecognitionErrorEvent extends Event {
  readonly error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  /** Chrome 135 and later listen to the given track; older ones, the default mic. */
  start(track?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}
type OnDevice = { langs: string[]; processLocally: true };
export interface SpeechApi {
  new (): Recognition;
  available?(
    options: OnDevice,
  ): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  install?(options: OnDevice): Promise<boolean>;
}

/** The browser's speech recognition, if it has one. */
export function speechApi(): SpeechApi | undefined {
  return (globalThis as { SpeechRecognition?: SpeechApi }).SpeechRecognition;
}

/**
 * Whether this device can transcribe the language without sending audio anywhere:
 * ready, after a one-time download (which the person starts), already downloading, or
 * not at all.
 */
export type SpeechSupport =
  "available" | "downloadable" | "downloading" | "unavailable";

const onDevice = (lang: string): OnDevice => ({
  langs: [lang],
  processLocally: true,
});

export async function speechSupport(
  api: SpeechApi | undefined,
  lang: string,
): Promise<SpeechSupport> {
  if (!api?.available) return "unavailable";
  try {
    return await api.available(onDevice(lang));
  } catch {
    return "unavailable";
  }
}

/**
 * Whether you're in the notes, as the notetaker's list says it: in them (when you speak,
 * unmuted), chose not to be, not yet (the one-time download, not started or under way),
 * or this browser can't. Null while that's still being found out.
 */
export function transcriptionStatus(input: {
  optedOut: boolean;
  support: SpeechSupport | "checking";
  failed: boolean;
}): TranscriptionStatus | null {
  if (input.optedOut) return "optedOut";
  if (input.failed || input.support === "unavailable") return "unsupported";
  if (input.support === "checking") return null;
  if (input.support === "downloadable") return "download";
  if (input.support === "downloading") return "downloading";
  return "on";
}

/** Downloads the language for on-device use. True once it's ready. */
export async function installSpeech(
  api: SpeechApi | undefined,
  lang: string,
): Promise<boolean> {
  if (!api?.install) return false;
  try {
    return await api.install(onDevice(lang));
  } catch {
    return false;
  }
}

/** Regions for the languages FaceOn speaks, where the browser names none. */
const REGIONS: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
};

/**
 * The language to listen for: the app's language, in the browser's own regional form
 * when it has one ("en-GB" for a British English browser), else a common region.
 */
export function speechLanguage(
  locale: string,
  browserLanguages: readonly string[],
): string {
  const base = (locale.split("-")[0] ?? locale).toLowerCase();
  const regional = browserLanguages.find(
    (tag) => tag.includes("-") && tag.split("-")[0]?.toLowerCase() === base,
  );
  if (regional) return regional;
  if (locale.includes("-")) return locale;
  return REGIONS[base] ?? locale;
}

/** Errors that won't go away by trying again. */
const FATAL = new Set([
  "not-allowed",
  "service-not-allowed",
  "language-not-supported",
]);
/** More failures than this within a minute, and it gives up. */
const MAX_FAILURES = 5;

export type Transcriber = {
  /** "finish" keeps the words already heard; "discard" drops them. */
  stop: (how: "finish" | "discard") => void;
};

/**
 * Transcribes a mic until stopped, one line per stretch of speech. The browser ends a
 * recognition now and then (after a silence, say), so this starts a new one each time.
 */
export function startTranscribing(options: {
  api: SpeechApi;
  lang: string;
  track: MediaStreamTrack | null;
  onLine: (text: string) => void;
  /** It stopped for good: the device refused, or it kept failing. */
  onFail: (reason: string) => void;
}): Transcriber {
  let stopped = false;
  let current: Recognition | null = null;
  let failures: number[] = [];
  let retry: ReturnType<typeof setTimeout> | undefined;

  function fail(reason: string) {
    stopped = true;
    options.onFail(reason);
  }

  function begin() {
    if (stopped) return;
    const recognition = new options.api();
    recognition.lang = options.lang;
    recognition.processLocally = true;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.isFinal ? result[0]?.transcript.trim() : "";
        if (text) options.onLine(text);
      }
    };
    recognition.onerror = (event) => {
      if (FATAL.has(event.error)) fail(event.error);
      // A silence or our own stop isn't a failure.
      else if (event.error !== "no-speech" && event.error !== "aborted") {
        failures.push(Date.now());
      }
    };
    recognition.onend = () => {
      current = null;
      if (stopped) return;
      const now = Date.now();
      failures = failures.filter((at) => now - at < 60_000);
      if (failures.length > MAX_FAILURES) fail("repeated-errors");
      else retry = setTimeout(begin, 250 + 1000 * failures.length);
    };
    try {
      if (options.track) recognition.start(options.track);
      else recognition.start();
      current = recognition;
    } catch {
      fail("start-failed");
    }
  }

  begin();
  return {
    stop(how) {
      stopped = true;
      clearTimeout(retry);
      if (current && how === "discard") {
        current.onresult = null;
        current.abort();
      } else current?.stop();
      current = null;
    },
  };
}
