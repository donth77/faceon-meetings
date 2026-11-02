"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import type { MotionId } from "@/lib/effects/effects";
import { createMotionPreview } from "@/lib/effects/motion-preview";

/** A moment some way in, where every motion background looks like itself. */
const STILL_AT = 9;

/**
 * A motion background's tile: one still frame, which moves while you point at or focus
 * the tile, unless your device asks for less motion.
 */
export function MotionThumb({ id, moving }: { id: MotionId; moving: boolean }) {
  const frame = useRef<HTMLSpanElement>(null);
  const preview = useRef<ReturnType<typeof createMotionPreview>>(null);
  const reduceMotion = useReducedMotion();
  const animate = moving && !reduceMotion;

  // A fresh canvas each time: a canvas whose WebGL context was released can't draw again.
  useEffect(() => {
    const host = frame.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 108;
    canvas.className = "size-full";
    host.append(canvas);
    const created = createMotionPreview(canvas, id);
    preview.current = created;
    created?.draw(STILL_AT);
    return () => {
      created?.dispose();
      preview.current = null;
      canvas.remove();
    };
  }, [id]);

  useEffect(() => {
    if (!animate) return;
    const begun = performance.now();
    let request = requestAnimationFrame(function tick(now) {
      preview.current?.draw(STILL_AT + (now - begun) / 1000);
      request = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(request);
  }, [animate]);

  return (
    <span ref={frame} aria-hidden="true" className="absolute inset-0 flex" />
  );
}
