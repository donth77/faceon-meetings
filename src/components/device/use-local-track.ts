"use client";

import { useEffect, useState } from "react";

import { supports } from "@/lib/capabilities";
import { deviceProblem, type DeviceProblem } from "@/lib/device/problems";

export type LocalTrack = {
  track: MediaStreamTrack | null;
  problem: DeviceProblem | null;
  /** Starting the device. */
  pending: boolean;
  retry: () => void;
};

function constraintsFor(
  kind: "audio" | "video",
  deviceId: string | undefined,
  noiseSuppression: boolean,
): MediaStreamConstraints {
  // `ideal` falls back to another device if the remembered one is gone.
  const device = deviceId ? { deviceId: { ideal: deviceId } } : {};
  return kind === "video"
    ? { video: { ...device, width: { ideal: 1280 }, height: { ideal: 720 } } }
    : {
        audio: {
          ...device,
          echoCancellation: true,
          noiseSuppression,
          autoGainControl: true,
        },
      };
}

/**
 * A camera or microphone track for the pre-join preview, using only browser APIs (no
 * media SDK before admission). Stopped whenever it's turned off, switched or unmounted,
 * so the camera light goes off.
 */
export function useLocalTrack(
  kind: "audio" | "video",
  enabled: boolean,
  deviceId: string | undefined,
  /** For a microphone: the browser's own noise suppression (standard, in Settings → Audio). */
  noiseSuppression = true,
): LocalTrack {
  const [attempt, setAttempt] = useState(0);
  const request = `${kind}|${deviceId ?? ""}|${noiseSuppression}|${attempt}`;
  const [result, setResult] = useState<{
    request: string;
    track: MediaStreamTrack | null;
    problem: DeviceProblem | null;
  }>({ request: "", track: null, problem: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let acquired: MediaStreamTrack | undefined;
    // Through a promise, so a missing mediaDevices (an insecure page) becomes a rejection.
    Promise.resolve()
      .then(() =>
        navigator.mediaDevices.getUserMedia(
          constraintsFor(kind, deviceId, noiseSuppression),
        ),
      )
      .then(
        (stream) => {
          acquired = stream.getTracks()[0];
          if (cancelled) acquired?.stop();
          else setResult({ request, track: acquired ?? null, problem: null });
        },
        (error: unknown) => {
          if (!cancelled) {
            setResult({
              request,
              track: null,
              problem: deviceProblem(error, supports("media")),
            });
          }
        },
      );
    return () => {
      cancelled = true;
      acquired?.stop();
    };
  }, [kind, enabled, deviceId, noiseSuppression, request]);

  // A track from an earlier time it was on was stopped when it went off; wait for the new one.
  const current =
    enabled &&
    result.request === request &&
    (result.track === null || result.track.readyState === "live");
  return {
    track: current ? result.track : null,
    problem: current ? result.problem : null,
    pending: enabled && !current,
    retry: () => setAttempt((n) => n + 1),
  };
}
