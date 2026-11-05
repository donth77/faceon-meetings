import { type Page, type ViewportSize } from "@playwright/test";

import { createMeeting } from "./support/db";
import {
  expect,
  expectNoErrors,
  needsStream,
  test,
  type People,
} from "./support/fixtures";
import {
  cameraOpens,
  longestGaps,
  ownCameraSize,
  received,
  trackOf,
  watchMedia,
} from "./support/media";
import { joinFromPreJoin, openMeeting } from "./support/meeting";

// Chrome's own test camera rather than the 320×180 file the other tests use: a picture
// of any size at 30 frames a second, so Stream sends its 720p, 360p and 180p copies.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--enable-unsafe-swiftshader",
    ],
  },
});

const tileVideo = (page: Page, name: string) =>
  page.locator(`[data-tile="video"][data-name="${name}"] video`).first();

/** Waits until someone's tile shows live video, and returns its track's ID. */
async function liveTrack(page: Page, name: string): Promise<string> {
  const video = tileVideo(page, name);
  await expect
    .poll(
      () =>
        video
          .evaluate(
            (element: HTMLVideoElement) =>
              element.readyState >= 2 && element.videoWidth > 0,
          )
          .catch(() => false),
      { timeout: 30_000 },
    )
    .toBe(true);
  const id = await trackOf(video);
  if (!id) throw new Error(`${name}'s tile plays no track.`);
  return id;
}

/** How many frames of a track this page has decoded so far. */
const framesOf = async (page: Page, trackId: string) =>
  (await received(page, trackId))?.framesDecoded ?? 0;

/** Expects frames of a track to keep arriving. */
async function expectFlowing(page: Page, trackId: string, name: string) {
  const before = await framesOf(page, trackId);
  await expect
    .poll(() => framesOf(page, trackId), {
      message: `${name}'s video keeps arriving`,
      timeout: 8_000,
    })
    .toBeGreaterThan(before + 10);
}

type WithPictureInPicture = Window & {
  documentPictureInPicture?: { window: Window | null };
};

/** Whether the picture-in-picture window is playing someone's video. */
const pictureInPicturePlaying = (page: Page) =>
  page.evaluate(() => {
    const pip = (window as WithPictureInPicture).documentPictureInPicture;
    const video = pip?.window?.document.querySelector("video");
    return Boolean(video && video.readyState >= 2);
  });

const closePictureInPicture = (page: Page) =>
  page.evaluate(() =>
    (window as WithPictureInPicture).documentPictureInPicture?.window?.close(),
  );

/**
 * Makes a page say it's in the background, or back, as switching tabs does: a headless
 * browser never hides one.
 */
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((hidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

/** How wide someone's tile is, in device pixels. */
const tileDeviceWidth = (page: Page, name: string) =>
  tileVideo(page, name).evaluate(
    (element: HTMLVideoElement) =>
      element.clientWidth * window.devicePixelRatio,
  );

/**
 * Maya hosts, then Jordan and Sam join as guests, everyone's camera on; Sam may have HD
 * video off. Returns once everyone sees everyone, with how often Sam's camera opened
 * before Join now (the preview).
 */
async function threePeople(
  people: People,
  options: {
    viewport?: ViewportSize;
    deviceScaleFactor?: number;
    samHdVideo?: boolean;
  } = {},
) {
  const host = await people.signedIn({
    name: "Maya Host",
    ...(options.viewport ? { viewport: options.viewport } : {}),
    ...(options.deviceScaleFactor
      ? { deviceScaleFactor: options.deviceScaleFactor }
      : {}),
  });
  const jordan = await people.guest();
  const sam = await people.guest();
  for (const person of [host, jordan, sam]) await watchMedia(person.context);
  if (options.samHdVideo === false) {
    await sam.context.addInitScript(() => {
      localStorage.setItem("faceon.prefs", JSON.stringify({ hdVideo: false }));
    });
  }
  const meeting = await createMeeting(host.user.id);
  await openMeeting(host.page, meeting);
  await joinFromPreJoin(host.page);
  await openMeeting(jordan.page, meeting);
  await joinFromPreJoin(jordan.page, "Jordan Lee");
  await openMeeting(sam.page, meeting);
  await expect(
    sam.page.getByRole("button", { name: "Join now" }),
  ).toBeVisible();
  const samOpensBeforeJoining = await cameraOpens(sam.page);
  await joinFromPreJoin(sam.page, "Sam Rivera");
  const tracks = {
    hostSeesJordan: await liveTrack(host.page, "Jordan Lee"),
    hostSeesSam: await liveTrack(host.page, "Sam Rivera"),
    samSeesJordan: await liveTrack(sam.page, "Jordan Lee"),
  };
  await liveTrack(sam.page, "Maya Host");
  await liveTrack(jordan.page, "Maya Host");
  await liveTrack(jordan.page, "Sam Rivera");
  return { host, jordan, sam, samOpensBeforeJoining, tracks };
}

test.describe("call quality", () => {
  test.beforeEach(() => needsStream());

  test("three people: HD video off stays off, and closing picture-in-picture leaves the stage playing", async ({
    people,
  }) => {
    const { host, jordan, sam, samOpensBeforeJoining, tracks } =
      await threePeople(people, { samHdVideo: false });

    // Sam's camera opened once in the meeting, at 640×360, and stayed there.
    expect(await ownCameraSize(sam.page)).toEqual({ width: 640, height: 360 });
    expect((await cameraOpens(sam.page)) - samOpensBeforeJoining).toBe(1);

    // Picture-in-picture shows whoever's talking; closing it leaves them on the stage.
    await host.page
      .locator("footer")
      .getByRole("button", { name: "More" })
      .click();
    await host.page
      .getByRole("menuitem", { name: "Open picture-in-picture" })
      .click();
    await expect.poll(() => pictureInPicturePlaying(host.page)).toBe(true);
    await closePictureInPicture(host.page);
    await expectFlowing(host.page, tracks.hostSeesJordan, "Jordan");
    await expectFlowing(host.page, tracks.hostSeesSam, "Sam");
    expectNoErrors(host, jordan, sam);
  });

  test("on a phone, a camera scrolled out of the strip isn't sent until it's scrolled into view", async ({
    people,
  }) => {
    const { host, jordan, sam } = await threePeople(people, {
      viewport: { width: 360, height: 740 },
    });

    // Jordan shares their screen: Maya's phone shows it large, with everyone's camera in
    // a row under it, and Sam's, the last, past the edge of the screen.
    await jordan.page
      .locator("footer")
      .getByRole("button", { name: "Share screen" })
      .click();
    await jordan.page
      .getByRole("menuitem", { name: /^Your entire screen/ })
      .click();
    await expect(host.page.locator('[data-tile="screen"] video')).toBeVisible();
    const samTile = host.page.locator(
      '[data-tile="video"][data-name="Sam Rivera"]',
    );
    await expect
      .poll(async () => (await samTile.boundingBox())?.x ?? 0)
      .toBeGreaterThanOrEqual(360);
    const samTrack = await trackOf(samTile.locator("video"));
    if (!samTrack) throw new Error("Sam's tile has no track.");

    // Out of sight, nothing of Sam's camera arrives once the strip has settled: a measure
    // over a set time, so it waits that long.
    await host.page.waitForTimeout(2_000);
    const framesBefore = await framesOf(host.page, samTrack);
    await host.page.waitForTimeout(3_000);
    expect((await framesOf(host.page, samTrack)) - framesBefore).toBeLessThan(
      3,
    );

    // Scrolled into view, it plays.
    await samTile.scrollIntoViewIfNeeded();
    await expectFlowing(host.page, samTrack, "Sam");
    expectNoErrors(host, jordan, sam);
  });

  test("a page in the background gets everyone's smallest copy, and larger ones once it's back", async ({
    people,
  }) => {
    const { host, jordan, sam, tracks } = await threePeople(people);
    const widths = async () => [
      (await received(host.page, tracks.hostSeesJordan))?.width ?? 0,
      (await received(host.page, tracks.hostSeesSam))?.width ?? 0,
    ];

    // Stream sends each camera 320, 640 and 1280 wide; Maya's tiles take more than 320.
    await expect
      .poll(async () => Math.min(...(await widths())), { timeout: 30_000 })
      .toBeGreaterThan(320);
    await setHidden(host.page, true);
    await expect
      .poll(async () => Math.max(...(await widths())), { timeout: 20_000 })
      .toBeLessThanOrEqual(320);
    await setHidden(host.page, false);
    await expect
      .poll(async () => Math.min(...(await widths())), { timeout: 30_000 })
      .toBeGreaterThan(320);
    expectNoErrors(host, jordan, sam);
  });

  // How sharp and how steady depend on how much the computer can encode, so these run
  // nightly rather than beside every other test.
  test("a Retina screen gets the copy that fills its tile, and a new layout stalls nobody's video @nightly", async ({
    people,
  }) => {
    const { host, jordan, sam, tracks } = await threePeople(people, {
      deviceScaleFactor: 2,
    });

    // Jordan sends at most 1280 wide; the media server starts each video small and sends
    // larger copies as the connection proves it can take them.
    const tile = await tileDeviceWidth(host.page, "Jordan Lee");
    const width = async () =>
      (await received(host.page, tracks.hostSeesJordan))?.width ?? 0;
    await expect
      .poll(width, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(0.75 * Math.min(tile, 1280));
    console.log(
      `Jordan's video: ${await width()}px for a tile ${Math.round(tile)} device pixels wide on Maya's Retina screen; ` +
        `${(await received(sam.page, tracks.samSeesJordan))?.width ?? 0}px for one ${Math.round(await tileDeviceWidth(sam.page, "Jordan Lee"))} wide on Sam's`,
    );

    // A new layout makes every tile anew; nobody's video stops on the way.
    const gaps = await longestGaps(
      host.page,
      [tracks.hostSeesJordan, tracks.hostSeesSam],
      async () => {
        await host.page.getByRole("button", { name: /^Layout:/ }).click();
        await host.page
          .getByRole("menuitemradio", { name: /^Speaker/ })
          .click();
      },
    );
    console.log(
      `Longest gap in each video while switching to Speaker: ${gaps.join(" ms, ")} ms`,
    );
    expect(Math.max(...gaps)).toBeLessThan(600);
    expectNoErrors(host, jordan, sam);
  });
});
