"use client";

import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";

import { formattingLocale } from "@/lib/time";

/**
 * Settings kept on this device (localStorage), for signed-in people and guests alike.
 * Unset means the default, so a default can improve later without a migration.
 */
export type Preferences = {
  /** 12- or 24-hour times; unset follows the region. */
  timeFormat?: "12" | "24";
  /** A time zone other than the device's. */
  timeZone?: string;
  /** The browser's noise suppression on the microphone. Default on. */
  noiseSuppression?: boolean;
  /** Your own camera shown mirrored, to you only. Default on. */
  mirrorVideo?: boolean;
  /** Sending 720p rather than 360p. Default on. */
  hdVideo?: boolean;
  /** Joining with the camera off, whatever it was last time. Default off. */
  cameraOffOnJoin?: boolean;
  /** "?" for shortcuts and Space to talk. Default on. */
  singleKeyShortcuts?: boolean;
  /** Others' reactions show (yours always do). Default on. */
  showOthersReactions?: boolean;
  /** Reactions float up the screen; off, they appear in place. Default on. */
  reactionAnimation?: boolean;
  /** A soft sound with each reaction. Default off, as in Meet. */
  reactionSound?: boolean;
  /** What screen readers hear about reactions. Default a summary. */
  reactionAnnouncements?: "off" | "summary" | "each";
  /** Sounds as you and others join and leave, and as you're let in. Default on. */
  soundPeople?: boolean;
  /** A sound with a new chat message while Chat is closed. Default on. */
  soundChat?: boolean;
  /** A sound when a hand goes up (hosts). Default on. */
  soundHands?: boolean;
  /** A sound when someone asks to join (hosts). Default on. */
  soundLobby?: boolean;
  /** A pop-up with each new message while Chat is closed. Default on. */
  popupChat?: boolean;
  /** A pop-up when a hand goes up (hosts). Default on. */
  popupHands?: boolean;
  /** A pop-up when someone asks to join (hosts). Default on. */
  popupLobby?: boolean;
  /** Hold Space to talk while muted. Default off, as in Meet. */
  pushToTalk?: boolean;
};

const KEY = "faceon.prefs";
const CHANGED = "faceon:prefs";
const BOOLEANS = [
  "noiseSuppression",
  "mirrorVideo",
  "hdVideo",
  "cameraOffOnJoin",
  "singleKeyShortcuts",
  "showOthersReactions",
  "reactionAnimation",
  "reactionSound",
  "soundPeople",
  "soundChat",
  "soundHands",
  "soundLobby",
  "popupChat",
  "popupHands",
  "popupLobby",
  "pushToTalk",
] as const;

let cached: { raw: string | null; value: Preferences } | null = null;
/** Choices made while storage is blocked; they last until the page reloads. */
let memory: Preferences = {};

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (cached?.raw === raw) return cached.value;
    const parsed: unknown = JSON.parse(raw ?? "null");
    const value: Preferences = {};
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      if (p.timeFormat === "12" || p.timeFormat === "24")
        value.timeFormat = p.timeFormat;
      if (typeof p.timeZone === "string") value.timeZone = p.timeZone;
      for (const key of BOOLEANS) {
        if (typeof p[key] === "boolean") value[key] = p[key];
      }
      const announce = p.reactionAnnouncements;
      if (announce === "off" || announce === "summary" || announce === "each") {
        value.reactionAnnouncements = announce;
      }
      // The earlier single "Meeting sounds" switch, turned off, turns every sound off.
      if (p.meetingSounds === false) {
        value.soundPeople ??= false;
        value.soundChat ??= false;
        value.soundHands ??= false;
        value.soundLobby ??= false;
      }
      if (value.reactionAnnouncements !== undefined) {
        // Already chosen.
      } else if (p.announceReactions === false) {
        // The earlier Accessibility switch, turned off.
        value.reactionAnnouncements = "off";
      }
    }
    cached = { raw, value };
    return value;
  } catch {
    return memory;
  }
}

/** Saves some settings; `undefined` goes back to the default. */
export function savePreferences(patch: Preferences): void {
  const next: Preferences = { ...loadPreferences(), ...patch };
  for (const key of Object.keys(next) as Array<keyof Preferences>) {
    if (next[key] === undefined) delete next[key];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    memory = next;
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

const NONE: Preferences = {};

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, loadPreferences, () => NONE);
}

/** The settings with their defaults filled in, for the code that acts on them. */
export function withDefaults(preferences: Preferences) {
  return {
    noiseSuppression: preferences.noiseSuppression ?? true,
    mirrorVideo: preferences.mirrorVideo ?? true,
    hdVideo: preferences.hdVideo ?? true,
    cameraOffOnJoin: preferences.cameraOffOnJoin ?? false,
    singleKeyShortcuts: preferences.singleKeyShortcuts ?? true,
    showOthersReactions: preferences.showOthersReactions ?? true,
    reactionAnimation: preferences.reactionAnimation ?? true,
    reactionSound: preferences.reactionSound ?? false,
    reactionAnnouncements: preferences.reactionAnnouncements ?? "summary",
    soundPeople: preferences.soundPeople ?? true,
    soundChat: preferences.soundChat ?? true,
    soundHands: preferences.soundHands ?? true,
    soundLobby: preferences.soundLobby ?? true,
    popupChat: preferences.popupChat ?? true,
    popupHands: preferences.popupHands ?? true,
    popupLobby: preferences.popupLobby ?? true,
    pushToTalk: preferences.pushToTalk ?? false,
  };
}

function subscribeLanguages(onChange: () => void) {
  window.addEventListener("languagechange", onChange);
  return () => window.removeEventListener("languagechange", onChange);
}

const browserLanguage = () =>
  navigator.languages?.[0] ?? navigator.language ?? "";

/**
 * The locale for Intl formatting: the browser's region, and the 12- or 24-hour choice
 * from Settings ("en-GB-u-hc-h12"), so every date and time FaceOn shows follows them.
 * The server renders with the plain language; the browser's region applies once loaded.
 */
export function useIntlLocale(): string {
  const locale = useLocale();
  const browser = useSyncExternalStore(
    subscribeLanguages,
    browserLanguage,
    () => "",
  );
  const { timeFormat } = usePreferences();
  const base = formattingLocale(locale, browser);
  if (!timeFormat) return base;
  return `${base}-u-hc-${timeFormat === "24" ? "h23" : "h12"}`;
}
