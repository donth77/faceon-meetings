"use client";

import { useEffect, useEffectEvent } from "react";

import { supports } from "@/lib/capabilities";
import {
  isAppleDevice,
  isInteractiveTarget,
  isTypingTarget,
} from "@/lib/platform";
import { loadPreferences, withDefaults } from "@/lib/preferences";

import { FOCUS_KEYS, spaceTalks } from "./push-to-talk";

/**
 * Zoom's and Meet's shortcuts both work: Ctrl/⌘+D or Alt/⌥+A toggles the mic,
 * Ctrl/⌘+E or Alt/⌥+V the camera, and Alt/⌥+S screen sharing. With Push to talk on
 * (Settings → Audio, off by default as in Meet), holding Space talks while muted, unless
 * single-key shortcuts are off (Settings → Accessibility), also when a control you clicked
 * has focus (push-to-talk.ts).
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
    // This press of Space is Push to talk's, from keydown to keyup.
    let spaceHeld = false;
    // Focus got where it is from the keyboard, rather than a click.
    let keyboardFocus = false;
    const stopTalking = () => {
      if (!talking) return;
      talking = false;
      if (micState().on) toggleMic();
    };

    function onSpace(event: KeyboardEvent): boolean {
      if (event.code !== "Space") return false;
      const { singleKeyShortcuts, pushToTalk } =
        withDefaults(loadPreferences());
      const talks = spaceTalks({
        pushToTalk,
        singleKeyShortcuts,
        plain:
          !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey,
        typing: isTypingTarget(event.target),
        onControl: isInteractiveTarget(event.target),
        keyboardFocus,
      });
      if (!talks) return false;
      // Not a press of the focused control, and no page scroll while held.
      event.preventDefault();
      event.stopPropagation();
      spaceHeld = true;
      if (event.repeat || talking) return true;
      const { on, allowed } = micState();
      if (!on && allowed) {
        talking = true;
        toggleMic();
      }
      return true;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (FOCUS_KEYS.has(event.key)) keyboardFocus = true;
      if (onSpace(event) || isTypingTarget(event.target) || event.repeat)
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
      } else if (zoom && event.code === "KeyS" && supports("screenShare")) {
        event.preventDefault();
        toggleShare();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      if (spaceHeld) {
        spaceHeld = false;
        event.preventDefault();
        event.stopPropagation();
      }
      stopTalking();
    }
    const onPointerDown = () => {
      keyboardFocus = false;
    };
    // Capturing, ahead of the focused control's own handling of Space.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    // Switching away mid-press never sends the keyup.
    window.addEventListener("blur", stopTalking);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("blur", stopTalking);
    };
  }, []);
}

/** The shortcut hint shown in tooltips, e.g. "Ctrl+D" or "⌘D". */
export function shortcutLabel(key: "D" | "E"): string {
  return isAppleDevice() ? `⌘${key}` : `Ctrl+${key}`;
}
