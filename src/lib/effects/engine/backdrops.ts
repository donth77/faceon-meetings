import { stillFile, type Effect } from "../effects";
import { getUpload } from "../uploads";
import type { Backdrop } from "./compositor";

/** What an effect puts behind the person, and how to let it go afterwards. */
export type LoadedBackdrop = { backdrop: Backdrop; release: () => void };

const nothingToRelease = () => {};

/** Blur and motion backgrounds are ready at once; images and videos load first. */
export function readyBackdrop(effect: Effect): LoadedBackdrop | null {
  if (effect.kind === "blur") {
    return {
      backdrop: { kind: "blur", level: effect.level },
      release: nothingToRelease,
    };
  }
  if (effect.kind === "motion") {
    return {
      backdrop: { kind: "motion", id: effect.id },
      release: nothingToRelease,
    };
  }
  return null;
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
  if (effect.kind === "upload") {
    const upload = await getUpload(effect.id);
    if (!upload) throw new Error("That background isn't on this device.");
    return upload.kind === "image"
      ? image(await createImageBitmap(upload.file))
      : video(upload.file);
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

/** A looping video, muted, drawn from wherever it has got to on each frame. */
async function video(file: Blob): Promise<LoadedBackdrop> {
  const element = document.createElement("video");
  const url = URL.createObjectURL(file);
  element.muted = true;
  element.loop = true;
  element.playsInline = true;
  element.src = url;
  const release = () => {
    element.pause();
    element.removeAttribute("src");
    element.load();
    URL.revokeObjectURL(url);
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
