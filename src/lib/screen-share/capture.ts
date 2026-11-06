/** Chrome's picker hints, which TypeScript's DOM types don't list yet. */
type DisplayMediaHints = DisplayMediaStreamOptions & {
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
};

/**
 * Asks the browser for a screen to share part of: its picker opens on the screens, and
 * FaceOn's own tab isn't offered. Switching what's shared mid-share isn't offered either,
 * since the chosen area belongs to this screen. Text goes at up to 15 frames a second,
 * so each frame gets more of the bitrate and stays sharp; video clips at up to 30.
 */
export function captureScreen(options: {
  audio: boolean;
  motion: boolean;
}): Promise<MediaStream> {
  const hints: DisplayMediaHints = {
    video: {
      displaySurface: "monitor",
      frameRate: { max: options.motion ? 30 : 15 },
    },
    audio: options.audio,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "exclude",
    ...(options.audio ? { systemAudio: "include" as const } : {}),
  };
  return navigator.mediaDevices.getDisplayMedia(hints);
}
