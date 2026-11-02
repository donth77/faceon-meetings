import { expect, type Locator, type Page } from "@playwright/test";

/** Opens a meeting's page, with the passcode in the link as an invitation has it. */
export async function openMeeting(
  page: Page,
  meeting: { code: string; passcode?: string },
) {
  await page.goto(
    `/j/${meeting.code}${meeting.passcode ? `#pwd=${meeting.passcode}` : ""}`,
  );
}

/** From pre-join into the room: Join now (or Ask to join), then wait for the controls. */
export async function joinFromPreJoin(page: Page, name?: string) {
  if (name) await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("button", { name: "Leave" })).toBeVisible({
    timeout: 60_000,
  });
}

/**
 * How sharp a video looks: the mean difference between neighbouring pixels' brightness,
 * over the whole frame and the top-left corner (the test camera's timecode).
 */
export async function sharpness(
  video: Locator,
): Promise<{ edges: number; corner: number } | null> {
  return video.evaluate((element) => {
    const source = element as HTMLVideoElement;
    if (source.readyState < 2 || source.videoWidth === 0) return null;
    const width = 160;
    const height = 90;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    const light = (i: number) =>
      0.2126 * (data[i] ?? 0) +
      0.7152 * (data[i + 1] ?? 0) +
      0.0722 * (data[i + 2] ?? 0);
    const difference = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return (
        Math.abs(light(i) - light(i + 4)) +
        Math.abs(light(i) - light(i + width * 4))
      );
    };
    let edges = 0;
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) edges += difference(x, y);
    }
    let corner = 0;
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 50; x++) corner += difference(x, y);
    }
    return {
      edges: edges / ((width - 1) * (height - 1)),
      corner: corner / (50 * 18),
    };
  });
}

/** Polls a video until its sharpness passes `accept`, and returns that reading. */
export async function waitForSharpness(
  video: Locator,
  accept: (reading: { edges: number; corner: number }) => boolean,
  timeout = 30_000,
) {
  let last: { edges: number; corner: number } | null = null;
  await expect
    .poll(
      async () => {
        last = await sharpness(video).catch(() => null);
        return last !== null && accept(last);
      },
      { timeout, intervals: [500] },
    )
    .toBe(true);
  return last as unknown as { edges: number; corner: number };
}
