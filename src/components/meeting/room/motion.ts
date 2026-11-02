"use client";

import { useReducedMotion, type Transition } from "motion/react";

/** The meeting's easing: quick to start, gentle to settle. */
export const ROOM_EASE = [0.2, 0, 0, 1] as const;

/**
 * How things move in the meeting: a quarter second, or not at all for people who
 * reduce motion in their device settings.
 */
export function useRoomTransition(duration = 0.24): Transition {
  const reduce = useReducedMotion();
  return reduce ? { duration: 0 } : { duration, ease: ROOM_EASE };
}
