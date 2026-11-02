import {
  loadRnnoise,
  RnnoiseWorkletNode,
} from "@sapphi-red/web-noise-suppressor";

/**
 * Strong noise suppression: RNNoise (Xiph, BSD-3-Clause), compiled to WebAssembly and
 * run in an AudioWorklet by @sapphi-red/web-noise-suppressor (MIT). Its files come from
 * our own origin: scripts/noise-assets.ts copies them into public/noise before `dev` and
 * `build`. It loads only when a microphone needs it.
 */
const BASE = "/noise";
/** RNNoise works on 48 kHz audio, in 10 ms frames. */
const SAMPLE_RATE = 48000;
/** How long the browser may take to start the audio. */
const START_MS = 1500;
/** How long the output may stay silent while the microphone hears something. */
const SILENT_MS = 2500;
const CHECK_MS = 500;

/** The browser didn't start the audio (it waits for a click on the page). */
export class AudioNotStarted extends Error {}

let binary: Promise<ArrayBuffer> | null = null;

/** The SIMD build where the browser supports it (all current ones), the plain one otherwise. */
function wasm(): Promise<ArrayBuffer> {
  binary ??= loadRnnoise({
    url: `${BASE}/rnnoise.wasm`,
    simdUrl: `${BASE}/rnnoise_simd.wasm`,
  });
  binary.catch(() => {
    binary = null;
  });
  return binary;
}

export type Suppression = {
  /** The cleaned audio, one channel at 48 kHz. */
  stream: MediaStream;
  stop: () => void;
};

/**
 * Runs a microphone through RNNoise. Throws when it can't start (no AudioWorklet, or
 * Firefox with a microphone at another sample rate); `onFailed` hears when it stops
 * working later (the browser suspends the audio, or nothing comes out while the
 * microphone hears something), so the caller can fall back to the browser's own.
 */
export async function startSuppression(
  input: MediaStream,
  onFailed: () => void,
): Promise<Suppression> {
  const microphone = input.getAudioTracks()[0];
  if (!microphone) throw new Error("There's no microphone to clean up.");
  const context = new AudioContext({
    sampleRate: SAMPLE_RATE,
    latencyHint: "interactive",
  });
  let node: RnnoiseWorkletNode | undefined;
  let watch: number | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(watch);
    context.onstatechange = null;
    node?.destroy();
    void context.close().catch(() => {});
  };
  const fail = () => {
    if (stopped) return;
    stop();
    onFailed();
  };

  try {
    const [wasmBinary] = await Promise.all([
      wasm(),
      context.audioWorklet.addModule(`${BASE}/rnnoise-worklet.js`),
    ]);
    const source = context.createMediaStreamSource(
      new MediaStream([microphone]),
    );
    node = new RnnoiseWorkletNode(context, { maxChannels: 1, wasmBinary });
    // One channel in: a microphone's source can be stereo (the same voice twice), and the
    // worklet cleans only the first, so a second, silent one would halve the level.
    node.channelCount = 1;
    node.channelCountMode = "explicit";
    const destination = context.createMediaStreamDestination();
    destination.channelCount = 1;
    source.connect(node).connect(destination);
    await started(context);
    watch = watchForSilence(context, source, node, fail);
    // A phone call or another app can suspend the audio: start it again, or give up.
    context.onstatechange = () => {
      if (stopped || context.state === "running") return;
      void started(context).catch(fail);
    };
    return { stream: destination.stream, stop };
  } catch (error) {
    stop();
    throw error;
  }
}

async function started(context: AudioContext) {
  if (context.state !== "running") {
    // A resume still waiting when the context closes rejects; nothing waits on it then.
    const resuming = context.resume().catch(() => {});
    await Promise.race([
      resuming,
      new Promise((resolve) => window.setTimeout(resolve, START_MS)),
    ]);
  }
  if (context.state !== "running") throw new AudioNotStarted();
}

/**
 * Fails when nothing comes out while the microphone hears something, for SILENT_MS:
 * suppression never silences speech completely, so that means it isn't working.
 */
function watchForSilence(
  context: AudioContext,
  input: AudioNode,
  output: AudioNode,
  onSilent: () => void,
): number {
  const heard = context.createAnalyser();
  const sent = context.createAnalyser();
  input.connect(heard);
  output.connect(sent);
  const before = new Float32Array(heard.fftSize);
  const after = new Float32Array(sent.fftSize);
  const peak = (samples: Float32Array) =>
    samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  let silentFor = 0;
  return window.setInterval(() => {
    heard.getFloatTimeDomainData(before);
    sent.getFloatTimeDomainData(after);
    const lost = peak(before) > 1e-3 && peak(after) === 0;
    silentFor = lost ? silentFor + CHECK_MS : 0;
    if (silentFor >= SILENT_MS) onSilent();
  }, CHECK_MS);
}
