"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  createCameraEffects,
  type CameraEffects,
  type EffectsProblem,
} from "@/lib/effects/camera-effects";
import type { Effect } from "@/lib/effects/effects";
import { availableEffect } from "@/lib/effects/support";
import {
  loadPreferences,
  setPreference,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import { useRoomMedia } from "../media";

type RoomEffects = {
  camera: CameraEffects;
  /** The saved effect when the room started, applied before the camera sent anything. */
  startedWith: Effect | null;
};

const RoomEffectsContext = createContext<RoomEffects | null>(null);

/** Sets up the room's camera effect from the saved choice; once per room. */
export function useNewRoomEffects(): RoomEffects {
  const [effects] = useState<RoomEffects>(() => {
    const saved = availableEffect(withDefaults(loadPreferences()).effect);
    return {
      camera: createCameraEffects(saved ?? { kind: "blur", level: "slight" }),
      startedWith: saved,
    };
  });
  return effects;
}

export function RoomEffectsProvider({
  value,
  children,
}: {
  value: RoomEffects;
  children: ReactNode;
}) {
  return <RoomEffectsContext value={value}>{children}</RoomEffectsContext>;
}

/**
 * Keeps the camera in step with the chosen effect (Settings → Backgrounds and effects,
 * or the meeting's panel), and stops effects, saying why, when they can't keep up or
 * can't run. If an effect can't run, the video goes off rather than the bare camera
 * being sent.
 */
export function useRoomEffects() {
  const t = useTranslations("Effects");
  const effects = use(RoomEffectsContext);
  const media = useRoomMedia();
  const { effect } = withDefaults(usePreferences());
  const registered = useRef(effects?.startedWith != null);

  const applyProcessor = useEffectEvent((on: boolean) => {
    if (!effects) return;
    void media.camera
      .setProcessor(on ? effects.camera.processor : null)
      .catch(() => {});
  });

  useEffect(() => {
    if (!effects) return;
    const usable = availableEffect(effect);
    if (usable) effects.camera.set(usable);
    const on = usable !== null;
    if (on === registered.current) return;
    registered.current = on;
    applyProcessor(on);
  }, [effect, effects]);

  const handleProblem = useEffectEvent((problem: EffectsProblem) => {
    if (problem.kind === "backgroundFailed") {
      setPreference("effect", problem.showing);
      toast(t("backgroundFailed"));
      return;
    }
    if (problem.kind === "failed" && media.camera.enabled) {
      void media.camera.toggle().catch(() => {});
    }
    setPreference("effect", null);
    toast(t(problem.kind === "tooSlow" ? "tooSlow" : "failed"));
  });

  useEffect(
    () => effects?.camera.subscribe((problem) => handleProblem(problem)),
    [effects],
  );
}
