import { wideCrop } from "./frame";

/**
 * Backgrounds people add: an image or a looping video, kept only in this browser
 * (IndexedDB) and never sent to FaceOn. Images are cropped to 16:9, at most 1920 × 1080;
 * an animated GIF keeps its first frame.
 */

export const UPLOAD_LIMITS = {
  imageMegabytes: 10,
  videoMegabytes: 50,
  videoSeconds: 60,
} as const;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
/** What the file picker offers. */
export const UPLOAD_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

export type Upload = {
  id: string;
  kind: "image" | "video";
  file: Blob;
  /** A small 16:9 picture for the picker. */
  thumb: Blob;
  addedAt: number;
};

export type UploadProblem = "type" | "tooBig" | "tooLong" | "unreadable";

export class UploadRejected extends Error {
  constructor(readonly problem: UploadProblem) {
    super(`The background wasn't added: ${problem}`);
  }
}

const DATABASE = "faceon-effects";
const STORE = "uploads";
const CHANGED = "faceon:uploads";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB"));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("IndexedDB"));
    });
  } finally {
    database.close();
  }
}

const changed = () => window.dispatchEvent(new Event(CHANGED));

/** Calls `onChange` when a background is added or removed. */
export function subscribeUploads(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/** Every added background, oldest first. */
export async function listUploads(): Promise<Upload[]> {
  const uploads = await run<Upload[]>("readonly", (store) => store.getAll());
  return uploads.sort((a, b) => a.addedAt - b.addedAt);
}

export function getUpload(id: string): Promise<Upload | undefined> {
  return run<Upload | undefined>("readonly", (store) => store.get(id));
}

export async function removeUpload(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
  changed();
}

/** Checks, prepares and keeps a picked file. Throws UploadRejected with the reason. */
export async function addUpload(file: File): Promise<Upload> {
  const kind = IMAGE_TYPES.includes(file.type)
    ? "image"
    : VIDEO_TYPES.includes(file.type)
      ? "video"
      : null;
  if (!kind) throw new UploadRejected("type");
  const limit =
    kind === "image"
      ? UPLOAD_LIMITS.imageMegabytes
      : UPLOAD_LIMITS.videoMegabytes;
  if (file.size > limit * 1024 * 1024) throw new UploadRejected("tooBig");
  const prepared =
    kind === "image" ? await prepareImage(file) : await prepareVideo(file);
  const upload: Upload = {
    id: crypto.randomUUID(),
    kind,
    ...prepared,
    addedAt: Date.now(),
  };
  await run("readwrite", (store) => store.put(upload));
  changed();
  return upload;
}

async function prepareImage(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadRejected("unreadable");
  }
  try {
    return {
      file: await drawWide(bitmap, bitmap, 1920, 0.9),
      thumb: await drawWide(bitmap, bitmap, 320, 0.8),
    };
  } finally {
    bitmap.close();
  }
}

async function prepareVideo(file: File) {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new UploadRejected("unreadable"));
      video.src = url;
    });
    // Some recordings don't say how long they are; the size limit still applies.
    if (
      Number.isFinite(video.duration) &&
      video.duration > UPLOAD_LIMITS.videoSeconds
    ) {
      throw new UploadRejected("tooLong");
    }
    const size = { width: video.videoWidth, height: video.videoHeight };
    return { file, thumb: await drawWide(video, size, 320, 0.8) };
  } catch (error) {
    throw error instanceof UploadRejected
      ? error
      : new UploadRejected("unreadable");
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** The middle 16:9 of a picture, `maxWidth` wide at most, as a JPEG. */
function drawWide(
  source: CanvasImageSource,
  size: { width: number; height: number },
  maxWidth: number,
  quality: number,
): Promise<Blob> {
  const crop = wideCrop(size, maxWidth);
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  canvas
    .getContext("2d")
    ?.drawImage(
      source,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      crop.width,
      crop.height,
    );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new UploadRejected("unreadable")),
      "image/jpeg",
      quality,
    ),
  );
}
