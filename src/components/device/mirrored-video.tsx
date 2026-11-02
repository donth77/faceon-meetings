"use client";

import { cn } from "cn";
import { useCallback } from "react";

/**
 * Your own camera, filling its box, mirrored when Settings says so (to you only: others
 * always see you the right way round). Pre-join, Settings and the meeting use it.
 */
export function MirroredVideo({
  track,
  mirror,
}: {
  track: MediaStreamTrack;
  mirror: boolean;
}) {
  const attach = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node) node.srcObject = new MediaStream([track]);
    },
    [track],
  );
  return (
    <video
      ref={attach}
      autoPlay
      playsInline
      muted
      className={cn(
        "absolute inset-0 size-full object-cover",
        mirror && "-scale-x-100",
      )}
    />
  );
}
