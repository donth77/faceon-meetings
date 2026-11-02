"use client";

import { useEffect, useState } from "react";

import {
  listUploads,
  subscribeUploads,
  type Upload,
} from "@/lib/effects/uploads";

export type ShownUpload = Upload & {
  /** An object URL for the picker's tile, revoked when the list changes. */
  thumbUrl: string;
  /** Its place among uploads of its kind, for "Your image 2". */
  number: number;
};

/** The backgrounds added on this device, kept current as they're added and removed. */
export function useUploads(): ShownUpload[] {
  const [uploads, setUploads] = useState<ShownUpload[]>([]);

  useEffect(() => {
    let cancelled = false;
    let shown: ShownUpload[] = [];
    function load() {
      listUploads().then(
        (list) => {
          if (cancelled) return;
          const counts = { image: 0, video: 0 };
          const next = list.map((upload) => ({
            ...upload,
            thumbUrl: URL.createObjectURL(upload.thumb),
            number: ++counts[upload.kind],
          }));
          shown.forEach((upload) => URL.revokeObjectURL(upload.thumbUrl));
          shown = next;
          setUploads(next);
        },
        () => {
          // Storage is blocked (a private window, say): no uploads to show.
        },
      );
    }
    load();
    const unsubscribe = subscribeUploads(load);
    return () => {
      cancelled = true;
      unsubscribe();
      shown.forEach((upload) => URL.revokeObjectURL(upload.thumbUrl));
    };
  }, []);

  return uploads;
}
