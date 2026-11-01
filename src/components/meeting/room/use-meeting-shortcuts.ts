"use client";

import { useEffect, useEffectEvent } from "react";

import { isAppleDevice } from "@/lib/platform";

import type { RoomMedia } from "../media";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Zoom's and Meet's shortcuts both work: Ctrl/⌘+D or Alt/⌥+A toggles the mic,
 * Ctrl/⌘+E or Alt/⌥+V the camera.
 */
export function useMeetingShortcuts(media: RoomMedia) {
  const toggleMic = useEffectEvent(() => void media.mic.toggle());
  const toggleCamera = useEffectEvent(() => void media.camera.toggle());

  useEffect(() => {
    const apple = isAppleDevice();
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || isTyping(event.target)) return;
      const primary = apple ? event.metaKey : event.ctrlKey;
      const meet = primary && !event.altKey && !event.shiftKey;
      // ⌥ changes the character on Apple keyboards, so match the physical key.
      const zoom = event.altKey && !event.ctrlKey && !event.metaKey;
      const key = event.key.toLowerCase();
      if ((meet && key === "d") || (zoom && event.code === "KeyA")) {
        event.preventDefault();
        toggleMic();
      } else if ((meet && key === "e") || (zoom && event.code === "KeyV")) {
        event.preventDefault();
        toggleCamera();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** The shortcut hint shown in tooltips, e.g. "Ctrl+D" or "⌘D". */
export function shortcutLabel(key: "D" | "E"): string {
  return isAppleDevice() ? `⌘${key}` : `Ctrl+${key}`;
}
