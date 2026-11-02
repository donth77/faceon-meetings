"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  loadEffectsEngine,
  reportingTo,
  type EffectsProblem,
} from "@/lib/effects/camera-effects";
import type { Effect } from "@/lib/effects/effects";
import type { EffectsProcessor } from "@/lib/effects/engine";

/**
 * A camera track with the chosen effect, for previews outside a meeting (pre-join,
 * Settings): the processed track while an effect is on, the camera's own otherwise,
 * and null while an effect starts, so the bare camera never shows in between.
 */
export function useEffectsTrack(
  track: MediaStreamTrack | null,
  effect: Effect | null,
  onProblem: (problem: EffectsProblem) => void,
): MediaStreamTrack | null {
  const [output, setOutput] = useState<{
    input: MediaStreamTrack;
    track: MediaStreamTrack;
  } | null>(null);
  const running = useRef<EffectsProcessor | null>(null);
  const on = effect !== null;
  const chosenEffect = useEffectEvent(() => effect);
  const report = useEffectEvent((problem: EffectsProblem) =>
    onProblem(problem),
  );

  // One processor per camera track while an effect is on; changing effects reuses it.
  useEffect(() => {
    if (!track || !on) return;
    let started: EffectsProcessor | undefined;
    let cancelled = false;
    loadEffectsEngine()
      .then(({ startEffects }) => {
        const chosen = chosenEffect();
        if (cancelled || !chosen) return;
        started = startEffects(track, chosen, reportingTo(report));
        running.current = started;
        setOutput({ input: track, track: started.track });
      })
      .catch(() => report({ kind: "failed" }));
    return () => {
      cancelled = true;
      started?.stop();
      running.current = null;
    };
  }, [track, on]);

  useEffect(() => {
    if (effect) running.current?.setEffect(effect);
  }, [effect]);

  if (!on) return track;
  return output?.input === track && output.track.readyState === "live"
    ? output.track
    : null;
}
