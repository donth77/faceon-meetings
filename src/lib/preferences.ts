"use client";

import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";

import { DESKTOP_LINKS, type DesktopLinks } from "@/lib/desktop/open-in-app";
import { parseEffect, type Effect } from "@/lib/effects/effects";
import {
  parseNoiseSuppression,
  type NoiseSuppression,
} from "@/lib/noise/noise";
import { formattingLocale } from "@/lib/time";

/**
 * Settings kept on this device (localStorage), for signed-in people and guests alike.
 * Unset means the default, so a default can improve later without a migration.
 */
/** The reminder choices, in minutes before a meeting; 0 is off. */
export const REMINDER_MINUTES = [0, 5, 10, 15] as const;
export type ReminderMinutes = (typeof REMINDER_MINUTES)[number];

export type Preferences = {
  /** 12- or 24-hour times; unset follows the region. */
  timeFormat?: "12" | "24";
  /** A time zone other than the device's. */
  timeZone?: string;
  /** Noise suppression on the microphone (see lib/noise). Default standard, the browser's own. */
  noiseSuppression?: NoiseSuppression;
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
  /**
   * Every meeting sound and pop-up, the reaction sound and meeting reminders. Off pauses
   * them all, while each keeps its own choice for when they're back. Default on.
   */
  notifications?: boolean;
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
  /** The meeting in a small window when you switch away, where Chrome allows. Default on. */
  autoPictureInPicture?: boolean;
  /** Hold Space to talk while muted. Default off, as in Meet. */
  pushToTalk?: boolean;
  /** Minutes before a meeting to remind you; 0 for never. Default 5, as in Zoom. */
  reminderMinutes?: ReminderMinutes;
  /** The background or effect on your camera, in every meeting. Default none. */
  effect?: Effect;
  /**
   * Where this browser knows the desktop app is installed: meeting links open it ("always"),
   * offer it ("ask", the default) or don't ("never").
   */
  desktopLinks?: DesktopLinks;
};

const KEY = "faceon.prefs";
const CHANGED = "faceon:prefs";
const BOOLEANS = [
  "mirrorVideo",
  "hdVideo",
  "cameraOffOnJoin",
  "singleKeyShortcuts",
  "showOthersReactions",
  "reactionAnimation",
  "reactionSound",
  "notifications",
  "soundPeople",
  "soundChat",
  "soundHands",
  "soundLobby",
  "popupChat",
  "popupHands",
  "popupLobby",
  "pushToTalk",
  "autoPictureInPicture",
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
      const minutes = REMINDER_MINUTES.find((m) => m === p.reminderMinutes);
      if (minutes !== undefined) value.reminderMinutes = minutes;
      const links = DESKTOP_LINKS.find((value) => value === p.desktopLinks);
      if (links) value.desktopLinks = links;
      const effect = parseEffect(p.effect);
      if (effect) value.effect = effect;
      const noise = parseNoiseSuppression(p.noiseSuppression);
      if (noise) value.noiseSuppression = noise;
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

/** Calls `onChange` when any setting changes, here or in another tab. */
export function subscribePreferences(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

const NONE: Preferences = {};

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    subscribePreferences,
    loadPreferences,
    () => NONE,
  );
}

/** The settings that have a default, as the code that acts on them sees them. */
export type Settings = Required<
  Omit<Preferences, "timeFormat" | "timeZone" | "effect">
> & { effect: Effect | null };

/** Every setting's default: one place to change one. */
export const DEFAULTS: Settings = {
  noiseSuppression: "standard",
  mirrorVideo: true,
  hdVideo: true,
  cameraOffOnJoin: false,
  singleKeyShortcuts: true,
  showOthersReactions: true,
  reactionAnimation: true,
  reactionSound: false,
  reactionAnnouncements: "summary",
  notifications: true,
  soundPeople: true,
  soundChat: true,
  soundHands: true,
  soundLobby: true,
  popupChat: true,
  popupHands: true,
  popupLobby: true,
  pushToTalk: false,
  autoPictureInPicture: true,
  reminderMinutes: 5,
  effect: null,
  desktopLinks: "ask",
};

/** What turning Notifications off pauses. Screen-reader announcements aren't among them. */
const PAUSED = {
  soundPeople: false,
  soundChat: false,
  soundHands: false,
  soundLobby: false,
  popupChat: false,
  popupHands: false,
  popupLobby: false,
  reactionSound: false,
  reminderMinutes: 0,
} satisfies Partial<Settings>;

/**
 * Each setting as chosen, with the defaults filled in: what Settings shows, including
 * the sounds, pop-ups and reminders that Notifications has paused.
 */
export function chosenSettings(preferences: Preferences): Settings {
  return { ...DEFAULTS, ...preferences };
}

/**
 * The settings with their defaults filled in, as the code that acts on them sees them.
 * With Notifications off, every sound, pop-up and reminder is off, whatever each one's
 * own choice (chosenSettings).
 */
export function withDefaults(preferences: Preferences): Settings {
  const settings = chosenSettings(preferences);
  return settings.notifications ? settings : { ...settings, ...PAUSED };
}

/**
 * What saving one setting stores: nothing when it's the default, so a default can
 * improve later for everyone who never changed it.
 */
export function preferencePatch<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Preferences {
  // Keys of Settings are keys of Preferences, with null standing for "unset".
  return { [key]: value === DEFAULTS[key] ? undefined : value } as Preferences;
}

/** Saves one setting (see preferencePatch). */
export function setPreference<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): void {
  savePreferences(preferencePatch(key, value));
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
