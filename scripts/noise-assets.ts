// Copies strong noise suppression's worklet and WebAssembly (RNNoise, from
// @sapphi-red/web-noise-suppressor) into public/noise/, so microphones load them from
// FaceOn's own origin. Runs before `dev` and `build`. The copies are generated, so git
// ignores them; their notices are in public/noise/CREDITS.md.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const target = new URL("../public/noise/", import.meta.url);

/** Each file as the package publishes it, and its name here. */
const FILES = [
  ["rnnoiseWorklet.js", "rnnoise-worklet.js"],
  ["rnnoise.wasm", "rnnoise.wasm"],
  ["rnnoise_simd.wasm", "rnnoise_simd.wasm"],
] as const;

mkdirSync(target, { recursive: true });
for (const [published, file] of FILES) {
  copyFileSync(
    require.resolve(`@sapphi-red/web-noise-suppressor/${published}`),
    new URL(file, target),
  );
}
