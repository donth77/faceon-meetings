import { useSyncExternalStore } from "react";

import {
  installSpeech,
  speechApi,
  speechSupport,
  type SpeechSupport,
} from "./speech";

/**
 * Whether this browser can turn speech into text on the device, per language: shared by
 * everything in the tab that shows it (the meeting, pre-join, Settings → AI notes), so a
 * download started in one place shows everywhere. "checking" until the browser answers.
 */
export type SpeechSetup = SpeechSupport | "checking";

const states = new Map<string, SpeechSetup>();
const asked = new Set<string>();
const downloads = new Map<string, Promise<boolean>>();
const listeners = new Set<() => void>();

function set(lang: string, state: SpeechSetup) {
  if (states.get(lang) === state) return;
  states.set(lang, state);
  listeners.forEach((listener) => listener());
}

/** Asks the browser; while another tab is downloading, asks again until it's done. */
async function check(lang: string) {
  const found = await speechSupport(speechApi(), lang);
  // This tab's own download says when it's done.
  if (downloads.has(lang)) return;
  set(lang, found);
  if (found === "downloading") setTimeout(() => void check(lang), 5000);
}

if (typeof document !== "undefined") {
  // Coming back to the tab: a download finished elsewhere (another tab, Chrome's own
  // settings) shows without a reload.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    for (const lang of asked) {
      if (states.get(lang) === "downloadable") void check(lang);
    }
  });
}

const subscribers = new Map<string, (listener: () => void) => () => void>();

/** One subscribe function per language, which asks the browser the first time. */
function subscriberFor(lang: string) {
  let subscribe = subscribers.get(lang);
  if (!subscribe) {
    subscribe = (listener) => {
      if (!asked.has(lang)) {
        asked.add(lang);
        void check(lang);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    };
    subscribers.set(lang, subscribe);
  }
  return subscribe;
}

/** This browser's speech-to-text for `lang`, asked the first time anything needs it. */
export function useSpeechSetup(lang: string): SpeechSetup {
  return useSyncExternalStore(
    subscriberFor(lang),
    () => states.get(lang) ?? "checking",
    () => "checking",
  );
}

/**
 * The one-time download that lets this browser transcribe `lang` on the device. Only
 * when the person asks for it; asking again while it runs joins the same download.
 * True once it's ready.
 */
export function downloadSpeech(lang: string): Promise<boolean> {
  const running = downloads.get(lang);
  if (running) return running;
  set(lang, "downloading");
  const job = installSpeech(speechApi(), lang).then(async (installed) => {
    const now = installed
      ? "available"
      : await speechSupport(speechApi(), lang);
    downloads.delete(lang);
    set(lang, now);
    return installed;
  });
  downloads.set(lang, job);
  return job;
}
