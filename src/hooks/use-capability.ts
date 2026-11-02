"use client";

import { useSyncExternalStore } from "react";

import {
  CAPABILITIES,
  subscribeCapability,
  supports,
  type Capability,
} from "@/lib/capabilities";

// One subscribe and one read per capability, made once, so React never resubscribes.
const SUBSCRIBE = Object.fromEntries(
  CAPABILITIES.map((capability) => [
    capability,
    (onChange: () => void) => subscribeCapability(capability, onChange),
  ]),
) as Record<Capability, (onChange: () => void) => () => void>;
const READ = Object.fromEntries(
  CAPABILITIES.map((capability) => [capability, () => supports(capability)]),
) as Record<Capability, () => boolean>;
const YES = () => true;
const NO = () => false;

/**
 * Whether this browser and device can do it (lib/capabilities.ts). On the server, and
 * while the page hydrates, it's `whileUnknown` (no, unless told otherwise) so the HTML
 * matches; it updates as soon as the browser takes over. Components that only ever
 * render in the browser get the real answer at once.
 */
export function useCapability(
  capability: Capability,
  whileUnknown = false,
): boolean {
  return useSyncExternalStore(
    SUBSCRIBE[capability],
    READ[capability],
    whileUnknown ? YES : NO,
  );
}
