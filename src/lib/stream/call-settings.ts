/**
 * The `meeting` call type's media settings, which `pnpm stream:setup` sets
 * (scripts/setup-stream.ts) and `pnpm stream:check` compares: what people's browsers
 * send each other. Free of imports, so the setup script can load it as it is.
 */

/** Cameras: 720p at 1.5 Mbps, with copies at 360p and 180p for smaller tiles. */
export const CAMERA = { width: 1280, height: 720, bitrate: 1_500_000 };

/**
 * Shared screens: text at 1080p and 15 frames a second, video clips at 720p and 30
 * (stream-media.tsx), both within this bitrate.
 */
export const SCREEN = { width: 1920, height: 1080, bitrate: 2_500_000 };

/**
 * What `pnpm stream:check` compares, as Stream's call type settings have them. Stream
 * replaces a whole section with what it's sent, so each is complete: a setting left out
 * would be turned off.
 */
export const MEDIA_SETTINGS = {
  video: {
    enabled: true,
    access_request_enabled: true,
    // The room turns each camera on or off itself, before joining.
    camera_default_on: true,
    camera_facing: "front",
    target_resolution: CAMERA,
  },
  screensharing: {
    enabled: true,
    access_request_enabled: true,
    target_resolution: SCREEN,
  },
  audio: {
    access_request_enabled: true,
    // The room turns each microphone on or off itself, before joining.
    mic_default_on: true,
    speaker_default_on: true,
    // Stream's apps for phones use it; browsers play through the chosen speaker.
    default_device: "speaker",
    // Nothing is sent while someone's quiet, and each packet carries the last one's
    // voice again, so a lost packet isn't heard.
    opus_dtx_enabled: true,
    redundant_coding_enabled: true,
    hifi_audio_enabled: false,
    // Strong noise suppression is FaceOn's own (lib/noise); Stream's isn't loaded.
    noise_cancellation: { mode: "disabled" },
  },
} as const;

/** The call type's settings. Each session's call overrides the limits with its own. */
export const MEETING_SETTINGS = {
  limits: { max_participants: 20 },
  ...MEDIA_SETTINGS,
} as const;

/**
 * Each media setting that differs from MEDIA_SETTINGS, as a dotted path
 * (`screensharing.target_resolution.bitrate`), given the call type's settings from
 * Stream (listCallTypes). Settings FaceOn doesn't set are left alone.
 */
export function settingsDrift(live: unknown): string[] {
  const drift: string[] = [];
  const compare = (expected: unknown, actual: unknown, path: string) => {
    if (expected !== null && typeof expected === "object") {
      const values =
        actual !== null && typeof actual === "object"
          ? (actual as Record<string, unknown>)
          : {};
      for (const [key, value] of Object.entries(expected)) {
        compare(value, values[key], path ? `${path}.${key}` : key);
      }
    } else if (expected !== actual) {
      drift.push(path);
    }
  };
  compare(MEDIA_SETTINGS, live, "");
  return drift;
}
