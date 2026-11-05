"use client";

/**
 * Settings → AI notes: the host's own AI key, if any, and its provider and model. Kept only
 * in this browser; keys go from here straight to their provider and nowhere else. No key
 * means notes are made on this computer, for free; a key means it's used.
 */
import { useSyncExternalStore } from "react";

import { z } from "@/lib/zod";

import { ENGINES } from "./notes";
import { isProvider, PROVIDERS, type ProviderId } from "./providers";

const byProvider = z
  .record(z.string(), z.string().max(400))
  .transform(
    (all) =>
      Object.fromEntries(
        Object.entries(all).filter(([id, value]) => isProvider(id) && value),
      ) as Partial<Record<ProviderId, string>>,
  );

const Stored = z.object({
  /**
   * How notes were made before there was only the key: "onDevice" or "ownKey". Read
   * once, to carry the choice over, and never written again.
   */
  engine: z.enum(ENGINES).optional().catch(undefined),
  provider: z.enum(PROVIDERS).optional().catch(undefined),
  models: byProvider.optional().catch(undefined),
  keys: byProvider.optional().catch(undefined),
  /** The key was removed as the choice carried over; said once in Settings. */
  keyRemoved: z.literal(true).optional().catch(undefined),
  /** Words to know: names and terms the notes spell exactly, as typed (`wordsToKnow`). */
  words: z.string().max(1000).optional().catch(undefined),
  /** Transcript only: notes are made only when asked for, after AI notes stop. */
  transcriptOnly: z.literal(true).optional().catch(undefined),
});
export type NotesSettings = Omit<z.infer<typeof Stored>, "engine">;

/**
 * Settings as stored, with an earlier choice carried over: "On this computer" stays free,
 * so a key kept beside it is removed (and that's said once); "Your own AI key" keeps
 * its key. `migrated` when that changed what's stored.
 */
export function fromStored(value: unknown): {
  settings: NotesSettings;
  migrated: boolean;
} {
  const parsed = Stored.safeParse(value);
  if (!parsed.success) return { settings: {}, migrated: false };
  const { engine, ...settings } = parsed.data;
  if (!engine) return { settings, migrated: false };
  if (engine === "ownKey") return { settings, migrated: true };
  const { keys, ...rest } = settings;
  const hadKey = Object.keys(keys ?? {}).length > 0;
  return {
    settings: hadKey ? { ...rest, keyRemoved: true } : rest,
    migrated: true,
  };
}

const KEY = "faceon.aiNotes";
const CHANGED = "faceon:aiNotes";
let cached: { raw: string | null; value: NotesSettings } = {
  raw: null,
  value: {},
};
let memory: NotesSettings = {};

export function loadNotesSettings(): NotesSettings {
  try {
    let raw = localStorage.getItem(KEY);
    if (raw === cached.raw) return cached.value;
    let value: NotesSettings = {};
    if (raw) {
      const stored = fromStored(JSON.parse(raw));
      value = stored.settings;
      // Carried over once: what's stored from now on is only what's used, so a removed
      // key is gone from this browser, not just unused.
      if (stored.migrated) {
        raw = JSON.stringify(value);
        localStorage.setItem(KEY, raw);
      }
    }
    cached = { raw, value };
    return value;
  } catch {
    return memory;
  }
}

/** Saves some settings; `undefined` goes back to the default. */
export function saveNotesSettings(patch: NotesSettings): void {
  const next: Record<string, unknown> = { ...loadNotesSettings(), ...patch };
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    memory = next as NotesSettings;
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Sets or clears one provider's model or key. */
export function saveForProvider(
  field: "models" | "keys",
  provider: ProviderId,
  value: string,
): void {
  const all = { ...loadNotesSettings()[field] };
  if (value.trim()) all[provider] = value.trim();
  else delete all[provider];
  saveNotesSettings({
    [field]: all,
    // A key added again: the note that it was removed has done its job.
    ...(field === "keys" && value.trim() ? { keyRemoved: undefined } : {}),
  });
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

const NONE: NotesSettings = {};

export function useNotesSettings(): NotesSettings {
  return useSyncExternalStore(subscribe, loadNotesSettings, () => NONE);
}
