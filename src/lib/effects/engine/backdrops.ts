import { motionFile, stillFile, type Effect } from "../effects";
import { getUpload } from "../uploads";
import type { Backdrop } from "./compositor";

/** What an effect puts behind the person, and how to let it go afterwards. */
export type LoadedBackdrop = { backdrop: Backdrop; release: () => void };

const nothingToRelease = () => {};

/** Blur is ready at once; pictures and videos load first. */
export function readyBackdrop(effect: Effect): LoadedBackdrop | null {
  if (effect.kind !== "blur") return null;
  return {
    backdrop: { kind: "blur", level: effect.level },
    release: nothingToRelease,
  };
}

export async function loadBackdrop(effect: Effect): Promise<LoadedBackdrop> {
  const ready = readyBackdrop(effect);
  if (ready) return ready;
  if (effect.kind === "still") {
    // Through an image element, which also reads SVG (createImageBitmap can't).
    const picture = new Image();
    picture.src = stillFile(effect.id);
    await picture.decode();
    return image(await createImageBitmap(picture));
  }
  if (effect.kind === "motion") return video(motionFile(effect.id));
  if (effect.kind === "upload") {
    const upload = await getUpload(effect.id);
    if (!upload) throw new Error("That background isn't on this device.");
    if (upload.kind === "image") {
      return image(await createImageBitmap(upload.file));
    }
    const url = URL.createObjectURL(upload.file);
    return video(url, () => URL.revokeObjectURL(url));
  }
  throw new Error("Unknown background.");
}

function image(bitmap: ImageBitmap): LoadedBackdrop {
  return {
    backdrop: {
      kind: "image",
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      live: false,
    },
    release: () => bitmap.close(),
  };
}

/**
 * A looping video, muted, drawn from wherever it has got to on each frame. `done` runs
 * once it's let go, for whatever its address needs (an object URL is revoked).
 */
async function video(
  src: string,
  done: () => void = nothingToRelease,
): Promise<LoadedBackdrop> {
  const element = document.createElement("video");
  element.muted = true;
  element.loop = true;
  element.playsInline = true;
  element.src = src;
  const release = () => {
    element.pause();
    element.removeAttribute("src");
    element.load();
    done();
  };
  try {
    await element.play();
  } catch (error) {
    release();
    throw error;
  }
  return {
    backdrop: {
      kind: "image",
      source: element,
      width: element.videoWidth,
      height: element.videoHeight,
      live: true,
    },
    release,
  };
}
