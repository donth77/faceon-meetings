import type { MicrophoneProcessor } from "@/lib/media/types";

import type { Suppression } from "./engine";
import { strongFailed } from "./support";

/** The engine loads on first use, so RNNoise stays out of everything else. */
export const loadNoiseEngine = () => import("./engine");

/**
 * Strong noise suppression for a meeting's microphone, for whichever media provider
 * runs the session: it runs on each microphone stream the provider opens. If it can't
 * run, the voice goes out as it is while the room switches to the browser's own
 * suppression (see support.ts).
 */
export function createNoiseProcessor(): MicrophoneProcessor {
  return (input) => {
    let started: Suppression | undefined;
    let stopped = false;
    const output = (async () => {
      try {
        const { startSuppression } = await loadNoiseEngine();
        if (stopped) return input;
        const suppression = await startSuppression(input, strongFailed);
        if (stopped) {
          suppression.stop();
          return input;
        }
        started = suppression;
        return suppression.stream;
      } catch {
        strongFailed();
        return input;
      }
    })();
    return {
      output,
      stop() {
        stopped = true;
        started?.stop();
      },
    };
  };
}
