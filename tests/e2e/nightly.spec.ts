import { type Page } from "@playwright/test";

import { createMeeting } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";
import {
  joinFromPreJoin,
  openMeeting,
  waitForSharpness,
} from "./support/meeting";

/**
 * Heavier checks for the nightly workflow (tagged @nightly): Firefox's own path for
 * backgrounds, and strong noise suppression in a real call.
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

test("strong noise suppression is on by default and runs in a call @nightly", async ({
  people,
}) => {
  needsStream();
  const host = await people.signedIn({ name: "Maya Host" });
  const { page } = host;
  await page.goto("/settings/audio");
  await expect(
    page.getByRole("button", { name: /Noise suppression/ }),
  ).toContainText("Strong");

  const meeting = await createMeeting(host.user.id);
  await openMeeting(page, meeting);
  await joinFromPreJoin(page);
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
