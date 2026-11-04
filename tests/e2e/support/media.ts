import type { BrowserContext, Locator, Page } from "@playwright/test";

/** What watchMedia keeps in each page. */
type Watched = {
  connections: RTCPeerConnection[];
  /** How often the page has asked for a camera. */
  cameraOpens: number;
};

type WatchedWindow = Window & { __faceonMedia?: Watched };

/**
 * Keeps each page's peer connections, for what they send and receive, and counts how
 * often the camera is opened. Before any page in the context loads.
 */
export async function watchMedia(context: BrowserContext) {
  await context.addInitScript(() => {
    const watched: Watched = { connections: [], cameraOpens: 0 };
    (window as WatchedWindow).__faceonMedia = watched;
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original {
      constructor(configuration?: RTCConfiguration) {
        super(configuration);
        watched.connections.push(this);
      }
    };
    const devices = navigator.mediaDevices;
    const open = devices.getUserMedia.bind(devices);
    devices.getUserMedia = (constraints) => {
      if (constraints?.video) watched.cameraOpens++;
      return open(constraints);
    };
  });
}

/** How often this page has opened a camera so far. */
export const cameraOpens = (page: Page) =>
  page.evaluate(
    () => (window as WatchedWindow).__faceonMedia?.cameraOpens ?? 0,
  );

/** The size your camera is captured at now, from your own tile. */
export const ownCameraSize = (page: Page) =>
  page
    .locator('[data-tile="video"][data-local] video')
    .first()
    .evaluate((element: HTMLVideoElement) => {
      const track = (
        element.srcObject as MediaStream | null
      )?.getVideoTracks()[0];
      const { width = 0, height = 0 } = track?.getSettings() ?? {};
      return { width, height };
    });

/** The ID of the track a video element plays, as its receiver knows it. */
export const trackOf = (video: Locator) =>
  video.evaluate(
    (element: HTMLVideoElement) =>
      (element.srcObject as MediaStream | null)?.getVideoTracks()[0]?.id ??
      null,
  );

export type Received = {
  width: number;
  height: number;
  framesDecoded: number;
  framesPerSecond: number;
};

/** What this page receives of a track now, from its receiver's stats. */
export const received = (page: Page, trackId: string) =>
  page.evaluate(async (id): Promise<Received | null> => {
    const watched = (window as WatchedWindow).__faceonMedia;
    for (const connection of watched?.connections ?? []) {
      if (connection.connectionState === "closed") continue;
      const receiver = connection
        .getReceivers()
        .find((candidate) => candidate.track.id === id);
      if (!receiver) continue;
      for (const stat of (await receiver.getStats()).values()) {
        const inbound = stat as Record<string, unknown>;
        if (inbound.type !== "inbound-rtp") continue;
        return {
          width: Number(inbound.frameWidth ?? 0),
          height: Number(inbound.frameHeight ?? 0),
          framesDecoded: Number(inbound.framesDecoded ?? 0),
          framesPerSecond: Number(inbound.framesPerSecond ?? 0),
        };
      }
    }
    return null;
  }, trackId);

/**
 * Watches the frames decoded of each track, every 50 ms, while `during` runs and for
 * `after` ms more: each track's longest stretch without a new frame, in ms. A measure
 * over a set time, so it waits that long rather than for a condition.
 */
export async function longestGaps(
  page: Page,
  trackIds: string[],
  during: () => Promise<void>,
  after = 3000,
): Promise<number[]> {
  await page.evaluate((ids) => {
    const watched = (window as WatchedWindow).__faceonMedia;
    const state = ids.map(() => ({
      frames: -1,
      since: performance.now(),
      gap: 0,
    }));
    const sample = async () => {
      const now = performance.now();
      await Promise.all(
        ids.map(async (id, index) => {
          const track = state[index];
          if (!track) return;
          for (const connection of watched?.connections ?? []) {
            const receiver = connection
              .getReceivers()
              .find((candidate) => candidate.track.id === id);
            if (!receiver) continue;
            for (const stat of (await receiver.getStats()).values()) {
              const inbound = stat as Record<string, unknown>;
              if (inbound.type !== "inbound-rtp") continue;
              const frames = Number(inbound.framesDecoded ?? 0);
              if (frames > track.frames) {
                track.gap = Math.max(track.gap, now - track.since);
                track.frames = frames;
                track.since = now;
              }
            }
          }
        }),
      );
    };
    const timer = window.setInterval(() => void sample(), 50);
    (window as WatchedWindow & { __faceonGaps?: () => number[] }).__faceonGaps =
      () => {
        window.clearInterval(timer);
        const now = performance.now();
        return state.map((track) =>
          Math.round(Math.max(track.gap, now - track.since)),
        );
      };
  }, trackIds);
  await during();
  await page.waitForTimeout(after);
  return page.evaluate(
    () =>
      (window as Window & { __faceonGaps?: () => number[] }).__faceonGaps?.() ??
      [],
  );
}
