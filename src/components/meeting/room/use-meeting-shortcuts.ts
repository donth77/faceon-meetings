"use client";

import { useEffect, useEffectEvent } from "react";

import {
  canShareScreen,
  isAppleDevice,
  isInteractiveTarget,
  isTypingTarget,
} from "@/lib/platform";
import { loadPreferences, withDefaults } from "@/lib/preferences";

/**
 * Zoom's and Meet's shortcuts both work: Ctrl/⌘+D or Alt/⌥+A toggles the mic,
 * Ctrl/⌘+E or Alt/⌥+V the camera, and Alt/⌥+S screen sharing. Holding Space talks
 * while muted, as in Zoom, unless single-key shortcuts are off (Settings → Accessibility).
 */
export function useMeetingShortcuts(actions: {
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  /** Whether the mic is on now, and whether you may turn it on. */
  mic: () => { on: boolean; allowed: boolean };
}) {
  const toggleMic = useEffectEvent(actions.toggleMic);
  const toggleCamera = useEffectEvent(actions.toggleCamera);
  const toggleShare = useEffectEvent(actions.toggleScreenShare);
  const micState = useEffectEvent(actions.mic);

  useEffect(() => {
    const apple = isAppleDevice();
    // Unmuted by holding Space; letting go mutes again.
    let talking = false;
    const stopTalking = () => {
      if (!talking) return;
      talking = false;
      if (micState().on) toggleMic();
    };

    function onSpace(event: KeyboardEvent): boolean {
      const plain =
        !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
      if (
        event.code !== "Space" ||
        !plain ||
        isInteractiveTarget(event.target)
      ) {
        return false;
      }
      if (!withDefaults(loadPreferences()).singleKeyShortcuts) return false;
      event.preventDefault(); // no page scroll while held
      if (event.repeat || talking) return true;
      const { on, allowed } = micState();
      if (!on && allowed) {
        talking = true;
        toggleMic();
      }
      return true;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || onSpace(event) || event.repeat)
        return;
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
      } else if (zoom && event.code === "KeyS" && canShareScreen()) {
        event.preventDefault();
        toggleShare();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") stopTalking();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Switching away mid-press never sends the keyup.
    window.addEventListener("blur", stopTalking);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stopTalking);
    };
  }, []);
}

/** The shortcut hint shown in tooltips, e.g. "Ctrl+D" or "⌘D". */
export function shortcutLabel(key: "D" | "E"): string {
  return isAppleDevice() ? `⌘${key}` : `Ctrl+${key}`;
}
