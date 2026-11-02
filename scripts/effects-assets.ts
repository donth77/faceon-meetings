// Copies MediaPipe's Wasm runtime into public/effects/, so backgrounds and effects load
// it from FaceOn's own origin. Runs before `dev` and `build`. The copies are generated,
// so git ignores them; the model beside them is committed.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const target = new URL("../public/effects/", import.meta.url);

mkdirSync(target, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) {
  copyFileSync(
    require.resolve(`@mediapipe/tasks-vision/${file}`),
    new URL(file, target),
  );
}
