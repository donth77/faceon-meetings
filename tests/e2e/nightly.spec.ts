import { type Page } from "@playwright/test";

import { createMeeting } from "./support/db";
import {
  expect,
  expectNoErrors,
  hydrated,
  needsStream,
  test,
} from "./support/fixtures";
import {
  joinFromPreJoin,
  openMeeting,
  waitForSharpness,
} from "./support/meeting";

/**
 * Heavier checks for the nightly workflow (tagged @nightly; it runs weekly): Firefox's own
 * path for backgrounds, and strong noise suppression in a real call.
 */

async function choose(page: Page, name: string) {
  const radio = page.getByRole("radio", { name, exact: true });
  await page.locator("label", { has: radio }).click();
  await expect(radio).toBeChecked();
}

test("Firefox draws backgrounds on the camera @nightly @firefox", async ({
  people,
}) => {
  const host = await people.signedIn();
  const { page } = host;
  await page.goto("/settings/effects");
  const preview = page
    .getByRole("img", { name: "Your video with this background" })
    .locator("video");
  await choose(page, "No effect");
  const raw = await waitForSharpness(preview, (r) => r.edges > 0);
  await choose(page, "Blur");
  await waitForSharpness(preview, (r) => r.edges < raw.edges * 0.6);
  expectNoErrors(host);
});

// Firefox's test camera runs at 15 frames a second (playwright.config.ts), slower than the
// 30-a-second timer its backgrounds are drawn on.
test("Firefox draws each frame of a slow camera once @nightly @firefox", async ({
  people,
}) => {
  const host = await people.signedIn();
  const { page } = host;
  // Counts the frames the effect draws, each starting with the camera's picture going to
  // its canvas, and those drawn again though the camera had shown nothing new. (The
  // preview can't tell: Firefox's canvas stream leaves out a frame drawn twice.)
  await host.context.addInitScript(() => {
    const counts = { drawn: 0, again: 0 };
    (window as Window & { __drawn?: typeof counts }).__drawn = counts;
    const watch = HTMLVideoElement.prototype.requestVideoFrameCallback;
    const cameras = new WeakMap<HTMLVideoElement, { shown: number }>();
    let drawnFrame = -1;
    const proto = WebGL2RenderingContext.prototype;
    const upload = proto.texImage2D as (...args: unknown[]) => void;
    (proto as unknown as { texImage2D: unknown }).texImage2D = function (
      this: WebGL2RenderingContext,
      ...args: unknown[]
    ) {
      const camera = args.at(-1);
      // The camera plays in a video element of the effect's own, outside the page;
      // MediaPipe reads it with a canvas of its own too.
      if (
        camera instanceof HTMLVideoElement &&
        !camera.isConnected &&
        this.canvas instanceof HTMLCanvasElement
      ) {
        let frames = cameras.get(camera);
        if (!frames) {
          const seen = { shown: 0 };
          frames = seen;
          cameras.set(camera, seen);
          const count: VideoFrameRequestCallback = (_now, metadata) => {
            seen.shown = metadata.presentedFrames;
            watch.call(camera, count);
          };
          watch.call(camera, count);
        }
        counts.drawn++;
        if (frames.shown === drawnFrame) counts.again++;
        drawnFrame = frames.shown;
      }
      upload.apply(this, args);
    };
  });
  await page.goto("/settings/effects");
  await choose(page, "Blur");
  const counts = () =>
    page.evaluate(
      () =>
        (window as Window & { __drawn?: { drawn: number; again: number } })
          .__drawn ?? { drawn: 0, again: 0 },
    );
  await expect.poll(async () => (await counts()).drawn).toBeGreaterThan(30);
  // Over three seconds, a measure over a set time.
  const before = await counts();
  await page.waitForTimeout(3000);
  const after = await counts();
  expect((after.drawn - before.drawn) / 3).toBeGreaterThan(5);
  expect((after.again - before.again) / 3).toBeLessThan(1);
  expectNoErrors(host);
});

test("strong noise suppression, once chosen, runs in a call @nightly", async ({
  people,
}) => {
  needsStream();
  const host = await people.signedIn({ name: "Maya Host" });
  const { page } = host;
  await page.goto("/settings/audio");
  const noise = page.getByRole("button", { name: /Noise suppression/ });
  // The browser's own is the default; Strong is a choice.
  await expect(noise).toContainText("Standard");
  await hydrated(noise);
  await noise.click();
  await page.getByRole("option", { name: /^Strong/ }).click();
  await expect(noise).toContainText("Strong");

  const meeting = await createMeeting(host.user.id);
  // RNNoise loads only for a microphone that uses it. Its worklet module never shows as a
  // request in Playwright, so wait for its Wasm, which the page fetches beside it.
  const rnnoise = page.waitForRequest(/\/noise\/rnnoise(_simd)?\.wasm$/);
  await openMeeting(page, meeting);
  await joinFromPreJoin(page);
  await rnnoise;
  const guest = await people.guest();
  await openMeeting(guest.page, meeting);
  await joinFromPreJoin(guest.page, "Jordan Lee");
  // Give it time to fail over, if it were going to.
  await page.waitForTimeout(5000);
  await expect(
    page.getByText(/Strong noise suppression stopped working/),
  ).toHaveCount(0);
  expectNoErrors(host, guest);
});
