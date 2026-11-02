"use client";

/**
 * Settings → AI notes: how notes are made, and the host's own AI keys. Kept only in
 * this browser; keys go from here straight to their provider and nowhere else.
 */
import { useSyncExternalStore } from "react";
import { z } from "zod";

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
  engine: z.enum(ENGINES).optional().catch(undefined),
  provider: z.enum(PROVIDERS).optional().catch(undefined),
  models: byProvider.optional().catch(undefined),
  keys: byProvider.optional().catch(undefined),
});
export type NotesSettings = z.infer<typeof Stored>;

const KEY = "faceon.aiNotes";
const CHANGED = "faceon:aiNotes";
let cached: { raw: string | null; value: NotesSettings } = {
  raw: null,
  value: {},
};
let memory: NotesSettings = {};

export function loadNotesSettings(): NotesSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cached.raw) return cached.value;
    let value: NotesSettings = {};
    if (raw) {
      const parsed = Stored.safeParse(JSON.parse(raw));
      if (parsed.success) value = parsed.data;
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
  saveNotesSettings({ [field]: all });
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
