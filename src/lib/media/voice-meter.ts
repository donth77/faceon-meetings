import {
  nextVoiceActivity,
  QUIET,
  rmsOf,
  type VoiceActivity,
} from "./voice-activity";

/** How often each voice is measured: 20 times a second. */
const TICK_MS = 50;
/** Samples per measurement: about 43 ms at 48 kHz, most of the time between two. */
const WINDOW = 2048;

type Source = {
  track: MediaStreamTrack;
  input: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  state: VoiceActivity;
  /** It has carried a voice. Until then the media server's word is used instead. */
  heard: boolean;
};

/**
 * Each person's voice, measured from their audio in this browser, so their speaking ring
 * and voice bars follow it at once: a media server's speaking events can come a second
 * after the voice. One AudioContext and one timer for everyone. Someone with no audio
 * (muted) isn't speaking. For anyone else not measured, or whose audio hasn't carried a
 * voice yet (a browser that can't measure it never will), it answers undefined, and the
 * adapter uses the media server's.
 */
export type VoiceMeter = {
  /**
   * Everyone's audio, by participant key (null or undefined: they have none); anyone
   * left out stops being measured.
   */
  measure(streams: ReadonlyMap<string, MediaStream | null | undefined>): void;
  speaking(key: string): boolean | undefined;
  /** How loud, from 0 to 1. */
  level(key: string): number | undefined;
  /** Hears when someone starts or stops speaking, or their level changes. */
  subscribe(onChange: () => void): () => void;
  /** Lets go of the audio; measuring again starts it afresh. */
  close(): void;
};

/** The steps of level the room shows (useAudioLevel rounds to 0.05). */
const shownLevel = (level: number) => Math.round(level * 20);

export function createVoiceMeter(): VoiceMeter {
  const sources = new Map<string, Source>();
  /** People with no audio: they aren't speaking. */
  const silent = new Set<string>();
  const listeners = new Set<() => void>();
  const samples = new Float32Array(WINDOW);
  let graph: {
    context: AudioContext;
    output: GainNode;
    stopWaiting: () => void;
  } | null = null;
  let timer: number | undefined;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  /** The audio graph, made on first use. */
  function audio() {
    if (!graph) {
      const context = new AudioContext();
      // Some browsers run only what reaches the speakers: a silent path keeps the
      // analysers running without playing anyone twice.
      const output = context.createGain();
      output.gain.value = 0;
      output.connect(context.destination);
      const stopWaiting =
        context.state === "running" ? () => {} : resumeOnGesture(context);
      graph = { context, output, stopWaiting };
    }
    return graph;
  }

  function release(key: string, source: Source) {
    source.input.disconnect();
    source.analyser.disconnect();
    sources.delete(key);
    return source.heard;
  }

  function tick() {
    if (graph?.context.state !== "running") return;
    const now = performance.now();
    let changed = false;
    for (const source of sources.values()) {
      source.analyser.getFloatTimeDomainData(samples);
      const next = nextVoiceActivity(source.state, rmsOf(samples), now);
      const before = source.state;
      source.state = next;
      if (next.speaking && !source.heard) {
        source.heard = true;
        changed = true;
      } else if (
        source.heard &&
        (next.speaking !== before.speaking ||
          shownLevel(next.level) !== shownLevel(before.level))
      ) {
        changed = true;
      }
    }
    if (changed) notify();
  }

  return {
    measure(streams) {
      let changed = false;
      for (const [key, source] of sources) {
        const track = streams.get(key)?.getAudioTracks()[0];
        if (track !== source.track || track.readyState === "ended") {
          changed = release(key, source) || changed;
        }
      }
      const wasSilent = new Set(silent);
      silent.clear();
      for (const [key, stream] of streams) {
        const track = stream?.getAudioTracks()[0];
        if (!track || track.readyState === "ended") {
          silent.add(key);
          if (!wasSilent.has(key)) changed = true;
          continue;
        }
        if (wasSilent.has(key)) changed = true;
        if (sources.has(key)) continue;
        try {
          const { context, output } = audio();
          const input = context.createMediaStreamSource(
            new MediaStream([track]),
          );
          const analyser = context.createAnalyser();
          analyser.fftSize = WINDOW;
          input.connect(analyser).connect(output);
          sources.set(key, {
            track,
            input,
            analyser,
            state: QUIET,
            heard: false,
          });
        } catch {
          // This browser can't measure it: the media server's word stands.
        }
      }
      if (sources.size > 0 && timer === undefined) {
        timer = window.setInterval(tick, TICK_MS);
      } else if (sources.size === 0 && timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
      if (changed) notify();
    },
    speaking(key) {
      const source = sources.get(key);
      if (source?.heard) return source.state.speaking;
      return silent.has(key) ? false : undefined;
    },
    level(key) {
      const source = sources.get(key);
      if (source?.heard) return source.state.level;
      return silent.has(key) ? 0 : undefined;
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    close() {
      window.clearInterval(timer);
      timer = undefined;
      let changed = false;
      for (const [key, source] of sources) {
        changed = release(key, source) || changed;
      }
      if (silent.size > 0) changed = true;
      silent.clear();
      graph?.stopWaiting();
      void graph?.context.close().catch(() => {});
      graph = null;
      if (changed) notify();
    },
  };
}

/**
 * Browsers hold audio until someone interacts with the page: starts it on the next press
 * or key. Returns a function that stops waiting.
 */
function resumeOnGesture(context: AudioContext): () => void {
  const stopWaiting = () => {
    window.removeEventListener("pointerdown", resume, true);
    window.removeEventListener("keydown", resume, true);
  };
  const resume = () => {
    void context
      .resume()
      .then(() => {
        if (context.state === "running") stopWaiting();
      })
      .catch(() => {});
  };
  window.addEventListener("pointerdown", resume, true);
  window.addEventListener("keydown", resume, true);
  return stopWaiting;
}
