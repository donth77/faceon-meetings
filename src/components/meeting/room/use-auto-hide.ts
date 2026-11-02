"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";

import type { RoomStatus } from "../media";
import {
  HIDE_AFTER_MS,
  mayHide,
  OWN_TAP_TARGETS,
  SETTLE_MS,
  shownAfterTap,
  type RoomFacts,
} from "./controls-visibility";

/**
 * Phones, upright or on their side: where the controls step aside for the video. A
 * short landscape screen counts only with a touch screen, so a short desktop window
 * keeps its controls.
 */
const COMPACT = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(COMPACT);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Whether the room is phone-sized (see COMPACT). The server renders the large room. */
export function useCompactRoom(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT).matches,
    () => false,
  );
}

/** On the top and bottom controls (controls-layer.tsx), so focus and touches on them count. */
const CONTROLS_ATTRIBUTE = "data-room-controls";

/** Menus, popovers, dialogs and toasts with a button: the controls stay while one shows. */
const OVERLAYS =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-sonner-toast] [data-action]';

/** Set once someone has seen "Tap to show controls" on this device. */
const HINT_SEEN = "faceon.tapToShowSeen";
const HINT_MS = 3500;

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_SEEN) === "1";
  } catch {
    return true;
  }
}

function rememberHint() {
  try {
    localStorage.setItem(HINT_SEEN, "1");
  } catch {
    // Private mode or blocked storage: the hint may show again; that's fine.
  }
}

const inControls = (node: EventTarget | Element | null) =>
  node instanceof Element && node.closest(`[${CONTROLS_ATTRIBUTE}]`) !== null;

/**
 * Focus a keyboard put on a control holds them up. A tap leaves focus on the button
 * tapped (no focus ring), and the meeting's name takes focus on joining; neither does.
 */
const keyboardOnControl = (node: Element | null) =>
  inControls(node) && node !== null && node.matches(":focus-visible");

/**
 * On a phone, the meeting's top and bottom controls fade after HIDE_AFTER_MS without a
 * touch, key or focus, so the video gets the screen, and a tap on the video brings them
 * back (or sends them away). They stay while anything holds them (controls-visibility.ts).
 * Any key shows them before the browser moves focus, so Tab never lands on a hidden
 * control; `keep` is for the stage's button for screen readers.
 */
export function useAutoHideControls(room: {
  compact: boolean;
  status: RoomStatus;
  presenting: boolean;
  alone: boolean;
  /** A side panel, or a sheet on a phone, is open. */
  panelOpen: boolean;
}) {
  const [shown, setShown] = useState(true);
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const joinedAt = useRef(0);
  const kept = useRef(false);
  // The latest facts, for the timer and listeners, which outlive a render.
  const latest = useRef(room);
  useEffect(() => {
    latest.current = room;
  });

  function facts(): RoomFacts {
    const now = latest.current;
    return {
      compact: now.compact,
      settled:
        now.status === "joined" && Date.now() - joinedAt.current >= SETTLE_MS,
      presenting: now.presenting,
      alone: now.alone,
      overlayOpen: now.panelOpen || document.querySelector(OVERLAYS) !== null,
      focusInControls: keyboardOnControl(document.activeElement),
      kept: kept.current,
    };
  }

  function arm() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (mayHide(facts())) hide();
      else arm();
    }, HIDE_AFTER_MS);
  }

  function hide() {
    clearTimeout(timer.current);
    setShown(false);
    if (!hintSeen()) {
      rememberHint();
      setHint(true);
      setTimeout(() => setHint(false), HINT_MS);
    }
  }

  function show() {
    setShown(true);
    arm();
  }

  // Count from when the room opened; on a phone, start the clock.
  const startClock = useEffectEvent(() => {
    joinedAt.current ||= Date.now();
    arm();
  });
  const stopClock = useEffectEvent(() => clearTimeout(timer.current));
  useEffect(() => {
    if (!room.compact) return;
    startClock();
    return () => stopClock();
  }, [room.compact]);

  // Something that holds the controls came up while they were hidden (someone left, a
  // reconnect): bring them back, and count again from when it ends.
  const held =
    room.presenting || room.alone || room.panelOpen || room.status !== "joined";
  const showAgain = useEffectEvent(() => show());
  useEffect(() => {
    if (!held || !room.compact) return;
    const later = setTimeout(() => showAgain(), 0);
    return () => clearTimeout(later);
  }, [held, room.compact]);

  // Before the browser acts on a key: a hidden control is never what Tab reaches.
  const onKey = useEffectEvent(() => {
    flushSync(() => setShown(true));
    arm();
  });
  const onFocus = useEffectEvent((event: FocusEvent) => {
    if (inControls(event.target)) show();
  });
  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    if (inControls(event.target)) arm();
  });
  const onPointerMove = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType === "mouse") show();
  });
  useEffect(() => {
    if (!room.compact) return;
    const key = () => onKey();
    const focus = (event: FocusEvent) => onFocus(event);
    const down = (event: PointerEvent) => onPointerDown(event);
    const move = (event: PointerEvent) => onPointerMove(event);
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", move);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
    };
  }, [room.compact]);

  return {
    /** Whether the controls show; always outside phone-sized rooms. */
    shown: !room.compact || shown,
    /** "Tap to show controls", the first time they hide on this device, while hidden. */
    hint: room.compact && hint && !shown,
    /** For the stage: a tap on the video shows or hides the controls. */
    onStageClick(event: MouseEvent) {
      if (!room.compact) return;
      if (
        event.target instanceof Element &&
        event.target.closest(OWN_TAP_TARGETS)
      ) {
        return;
      }
      kept.current = false;
      if (shownAfterTap(shown, facts())) show();
      else hide();
    },
    /** Shows the controls and keeps them up until the video is tapped. */
    keep() {
      kept.current = true;
      clearTimeout(timer.current);
      flushSync(() => setShown(true));
    },
  };
}
