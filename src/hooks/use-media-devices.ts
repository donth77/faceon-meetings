import { useEffect, useMemo, useState } from "react";

export type MediaDeviceLists = {
  microphones: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
};

/**
 * The microphones, cameras and speakers this browser offers, updated when devices are
 * plugged in or out. Labels appear only after camera or mic permission, so change
 * `refreshKey` (say, to the active track IDs) to list them again once it's granted.
 */
export function useMediaDevices(refreshKey: string): MediaDeviceLists {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    const refresh = () => {
      mediaDevices.enumerateDevices().then(
        (list) => {
          if (!cancelled) setDevices(list);
        },
        () => {}, // nothing to list
      );
    };
    refresh();
    mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      cancelled = true;
      mediaDevices.removeEventListener("devicechange", refresh);
    };
  }, [refreshKey]);

  return useMemo(() => {
    // Without permission, browsers return placeholder entries with empty IDs.
    const of = (kind: MediaDeviceKind) =>
      devices.filter((d) => d.kind === kind && d.deviceId !== "");
    return {
      microphones: of("audioinput"),
      cameras: of("videoinput"),
      speakers: of("audiooutput"),
    };
  }, [devices]);
}
