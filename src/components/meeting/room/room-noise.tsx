"use client";

import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useNoiseSuppression } from "@/components/device/use-noise-suppression";
import type { MicrophoneProcessor } from "@/lib/media/types";
import { createNoiseProcessor } from "@/lib/noise/microphone-noise";
import {
  browserSuppression,
  effectiveNoiseSuppression,
  type NoiseSuppression,
} from "@/lib/noise/noise";
import { strongAvailable } from "@/lib/noise/support";
import { loadPreferences, withDefaults } from "@/lib/preferences";

import { useRoomMedia } from "../media";

type RoomNoise = {
  processor: MicrophoneProcessor;
  /** The noise suppression the microphone started with. */
  startedWith: NoiseSuppression;
};

const RoomNoiseContext = createContext<RoomNoise | null>(null);

/** Sets up the room's noise suppression from the saved choice; once per room. */
export function useNewRoomNoise(): RoomNoise {
  const [noise] = useState<RoomNoise>(() => ({
    processor: createNoiseProcessor(),
    startedWith: effectiveNoiseSuppression(
      withDefaults(loadPreferences()).noiseSuppression,
      strongAvailable(),
    ),
  }));
  return noise;
}

export function RoomNoiseProvider({
  value,
  children,
}: {
  value: RoomNoise;
  children: ReactNode;
}) {
  return <RoomNoiseContext value={value}>{children}</RoomNoiseContext>;
}

/**
 * Keeps the microphone in step with the chosen noise suppression (Settings → Audio, here
 * or in the meeting's Settings), and moves it to the browser's own when strong stops
 * working (useNoiseSuppression says so once).
 */
export function useRoomNoise() {
  const noise = use(RoomNoiseContext);
  const media = useRoomMedia();
  const { mode } = useNoiseSuppression();
  const applied = useRef(noise?.startedWith);

  const apply = useEffectEvent(async (next: NoiseSuppression) => {
    if (!noise) return;
    // The processor goes before the browser's suppression comes back, and the other way
    // round, so the microphone restarts once and is never left with neither.
    if (next === "strong") {
      await media.mic.setNoiseSuppression(false);
      await media.mic.setProcessor(noise.processor);
    } else {
      await media.mic.setProcessor(null);
      await media.mic.setNoiseSuppression(browserSuppression(next));
    }
  });

  useEffect(() => {
    if (!noise || mode === applied.current) return;
    applied.current = mode;
    void apply(mode).catch(() => {});
  }, [mode, noise]);
}
