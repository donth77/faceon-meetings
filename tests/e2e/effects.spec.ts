import { type Page } from "@playwright/test";

import { createMeeting } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";
import {
  joinFromPreJoin,
  openMeeting,
  sharpness,
  waitForSharpness,
} from "./support/meeting";

/** Picks a background or effect by its tile's name. */
async function choose(page: Page, name: string) {
  // `has` looks inside each label, so it's given a locator rooted at the page.
  const radio = page.getByRole("radio", { name, exact: true });
  await page.locator("label", { has: radio }).click();
  await expect(radio).toBeChecked();
}

/** The preview in Settings → Backgrounds and effects: the camera as others will see it. */
const preview = (page: Page) =>
  page
    .getByRole("img", { name: "Your video with this background" })
    .locator("video");

/** How sharp the test camera's timecode corner is with no effect. */
async function sharpWithoutEffect(page: Page) {
  await page.goto("/settings/effects");
  await choose(page, "No effect");
  const raw = await waitForSharpness(preview(page), (r) => r.corner > 0);
  return raw.corner;
}

test.describe("backgrounds and effects", () => {
  test("blur softens the preview, and the choice is kept", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    const raw = await sharpWithoutEffect(page);
    await choose(page, "Blur");
    await waitForSharpness(preview(page), (r) => r.corner < raw * 0.45);
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("faceon.prefs") ?? "{}").effect,
    );
    expect(saved).toEqual({ kind: "blur", level: "strong" });
    expectNoErrors(host);
  });

  test("the other person receives the blurred video, never the camera as it is", async ({
    people,
  }) => {
    needsStream();
    const host = await people.signedIn({ name: "Maya Host" });
    const raw = await sharpWithoutEffect(host.page);
    await choose(host.page, "Blur");

    const meeting = await createMeeting(host.user.id);
    await openMeeting(host.page, meeting);
    await expect(host.page.getByText("Background on")).toBeVisible();
    await joinFromPreJoin(host.page);

    const guest = await people.guest();
    await openMeeting(guest.page, meeting);
    await joinFromPreJoin(guest.page, "Jordan Lee");
    const hostOnGuest = guest.page
      .locator('[data-tile="video"][data-name="Maya Host"]')
      .locator("video");
    // From the first frame the guest gets, the corner is already soft.
    const first = await waitForSharpness(hostOnGuest, () => true);
    expect(first.corner).toBeLessThan(raw * 0.6);
    await waitForSharpness(hostOnGuest, (r) => r.corner < raw * 0.45);
    expect(await sharpness(hostOnGuest)).not.toBeNull();
    expectNoErrors(host, guest);
  });
});
