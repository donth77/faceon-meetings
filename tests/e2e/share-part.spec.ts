import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page } from "@playwright/test";

import { createMeeting } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";
import { joinFromPreJoin, openMeeting } from "./support/meeting";

/** The meeting's control bar (Mute, Stop video, Leave…), not the tiles' buttons. */
const controls = (page: Page) => page.locator("footer");

/** The box's shape, its width over its height, from its name ("Part to share, 1280 × 720"). */
async function boxShape(box: Locator): Promise<number> {
  const name = (await box.getAttribute("aria-label")) ?? "";
  const [, width, height] = /(\d+) × (\d+)$/.exec(name) ?? [];
  if (!width || !height) throw new Error(`No size in "${name}".`);
  return Number(width) / Number(height);
}

/** Serious and critical WCAG 2.x A and AA problems axe finds in the area picker. */
async function axeProblems(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
}

/** The shape of the shared screen another person receives: its width over its height. */
const receivedShape = (page: Page) =>
  page
    .locator('[data-tile="screen"] video')
    .first()
    .evaluate((video: HTMLVideoElement) =>
      video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 0,
    );

test.describe("sharing part of a screen", () => {
  test.beforeEach(() => needsStream());

  test("only the area chosen is sent, it moves while shared, and nothing goes until it's chosen", async ({
    people,
  }) => {
    test.setTimeout(150_000);
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    await openMeeting(host.page, meeting);
    await joinFromPreJoin(host.page);
    const guest = await people.guest();
    await openMeeting(guest.page, meeting);
    await joinFromPreJoin(guest.page, "Jordan Lee");

    await controls(guest.page)
      .getByRole("button", { name: "Share screen" })
      .click();
    await guest.page
      .getByRole("menuitem", { name: /^Part of your screen/ })
      .click();
    const dialog = guest.page.getByRole("dialog", {
      name: "Choose the part to share",
    });
    await expect(dialog).toBeVisible();
    // Keyboard users start on the box. While it's open, nothing is shared.
    const box = dialog.getByRole("application", { name: /^Part to share, / });
    await expect(box).toBeFocused();
    await expect(host.page.locator('[data-tile="screen"]')).toHaveCount(0);
    expect(await axeProblems(guest.page)).toEqual([]);

    // Narrower by a tenth of the screen, then shared: that's the shape that arrives.
    for (let i = 0; i < 10; i++) await box.press("Shift+ArrowLeft");
    const chosen = await boxShape(box);
    await dialog.getByRole("button", { name: "Share this part" }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() => receivedShape(host.page), { timeout: 30_000 })
      .toBeCloseTo(chosen, 1);

    // Change area, without stopping: shorter, so wider than it was.
    await guest.page.getByRole("button", { name: "Change area" }).click();
    const again = guest.page.getByRole("dialog", {
      name: "Choose the part to share",
    });
    const moved = again.getByRole("application", { name: /^Part to share, / });
    for (let i = 0; i < 20; i++) await moved.press("Shift+ArrowUp");
    const changed = await boxShape(moved);
    expect(changed).toBeGreaterThan(chosen);
    await again.getByRole("button", { name: "Done" }).click();
    await expect
      .poll(() => receivedShape(host.page), { timeout: 30_000 })
      .toBeCloseTo(changed, 1);

    // Stop sharing: gone for everyone.
    await controls(guest.page)
      .getByRole("button", { name: "Stop sharing" })
      .click();
    await expect(host.page.locator('[data-tile="screen"]')).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(
      controls(guest.page).getByRole("button", { name: "Share screen" }),
    ).toBeVisible();
    expectNoErrors(host, guest);
  });

  test("cancelling the area shares nothing", async ({ people }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    await openMeeting(host.page, meeting);
    await joinFromPreJoin(host.page);

    await controls(host.page)
      .getByRole("button", { name: "Share screen" })
      .click();
    await host.page
      .getByRole("menuitem", { name: /^Part of your screen/ })
      .click();
    const dialog = host.page.getByRole("dialog", {
      name: "Choose the part to share",
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(host.page.locator('[data-tile="screen"]')).toHaveCount(0);
    await expect(
      controls(host.page).getByRole("button", { name: "Share screen" }),
    ).toBeVisible();
    expectNoErrors(host);
  });
});
