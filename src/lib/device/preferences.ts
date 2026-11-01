/**
 * Device choices remembered on this device (localStorage), so the next meeting starts
 * with the same camera, microphone and speaker, on or off as last time.
 */
export type DevicePreferences = {
  micOn: boolean;
  cameraOn: boolean;
  micId?: string;
  cameraId?: string;
  speakerId?: string;
};

const KEY = "faceon.devices";
const DEFAULTS: DevicePreferences = { micOn: true, cameraOn: true };

export function loadDevicePreferences(): DevicePreferences {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!stored || typeof stored !== "object") return DEFAULTS;
    const value = stored as Record<string, unknown>;
    const id = (key: string) =>
      typeof value[key] === "string" ? (value[key] as string) : undefined;
    return {
      micOn: value.micOn !== false,
      cameraOn: value.cameraOn !== false,
      micId: id("micId"),
      cameraId: id("cameraId"),
      speakerId: id("speakerId"),
    };
  } catch {
    return DEFAULTS; // storage blocked or corrupt
  }
}

export function saveDevicePreferences(preferences: DevicePreferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Storage is blocked (private mode, site data off): nothing to remember with.
  }
}
