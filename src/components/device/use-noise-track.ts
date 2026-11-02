"use client";

import { useEffect, useState } from "react";

import type { Suppression } from "@/lib/noise/engine";
import { loadNoiseEngine } from "@/lib/noise/microphone-noise";
import type { NoiseSuppression } from "@/lib/noise/noise";
import { strongFailed } from "@/lib/noise/support";

/**
 * A microphone track with strong noise suppression, for previews outside a meeting
 * (pre-join, Settings), so the meter shows what others would hear. The microphone's own
 * track while it starts, or when suppression isn't strong. Audio a browser holds back
 * until the page is clicked isn't a failure here: the meeting starts after a click.
 */
export function useNoiseTrack(
  track: MediaStreamTrack | null,
  mode: NoiseSuppression,
): MediaStreamTrack | null {
  const [output, setOutput] = useState<{
    input: MediaStreamTrack;
    track: MediaStreamTrack;
  } | null>(null);
  const strong = mode === "strong";

  useEffect(() => {
    if (!track || !strong) return;
    let started: Suppression | undefined;
    let cancelled = false;
    loadNoiseEngine()
      .then(async ({ startSuppression, AudioNotStarted }) => {
        try {
          return await startSuppression(new MediaStream([track]), strongFailed);
        } catch (error) {
          if (!(error instanceof AudioNotStarted)) throw error;
          return null;
        }
      })
      .then(
        (suppression) => {
          if (!suppression) return;
          if (cancelled) {
            suppression.stop();
            return;
          }
          started = suppression;
          const processed = suppression.stream.getAudioTracks()[0];
          if (processed) setOutput({ input: track, track: processed });
        },
        () => {
          if (!cancelled) strongFailed();
        },
      );
    return () => {
      cancelled = true;
      started?.stop();
    };
  }, [track, strong]);

  if (!strong || output?.input !== track) return track;
  return output.track.readyState === "live" ? output.track : track;
}
