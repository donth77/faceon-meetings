import { type Locator, type Page } from "@playwright/test";

import { createMeeting } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";
import { joinFromPreJoin, openMeeting } from "./support/meeting";

/** Someone's video tile, as another participant sees it. */
const tile = (page: Page, name: string) =>
  page.locator(`[data-tile="video"][data-name="${name}"]`);

/** Whether a tile is showing live video. */
const showingVideo = (tileLocator: Locator) =>
  tileLocator
    .locator("video")
    .first()
    .evaluate(
      (video: HTMLVideoElement) =>
        video.readyState >= 2 && video.videoWidth > 0,
    )
    .catch(() => false);

/** The meeting's control bar (Mute, Stop video, Leave…), not the tiles' buttons. */
const controls = (page: Page) => page.locator("footer");

test.describe("a meeting", () => {
  test.beforeEach(() => needsStream());

  test("a host and a guest see each other, chat, react, raise a hand, and the host ends it for all", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    await openMeeting(host.page, meeting);
    await joinFromPreJoin(host.page);

    const guest = await people.guest();
    await openMeeting(guest.page, meeting);
    await joinFromPreJoin(guest.page, "Jordan Lee");

    await expect
      .poll(() => showingVideo(tile(host.page, "Jordan Lee")), {
        timeout: 30_000,
      })
      .toBe(true);
    await expect
      .poll(() => showingVideo(tile(guest.page, "Maya Host")), {
        timeout: 30_000,
      })
      .toBe(true);

    // Chat: the guest writes, and the host gets it while Chat is closed.
    await guest.page.getByRole("button", { name: /^Chat/ }).first().click();
    await guest.page.getByLabel("Message everyone").fill("Hello from Jordan");
    await guest.page.keyboard.press("Enter");
    await expect(
      host.page.getByText("Hello from Jordan").first(),
    ).toBeVisible();

    // A reaction shows on the guest's tile for the host.
    await guest.page.getByRole("button", { name: "Reactions" }).click();
    await guest.page.getByRole("button", { name: "Clap" }).click();
    await expect(tile(host.page, "Jordan Lee")).toContainText("👏");
    await guest.page.keyboard.press("Escape");

    // A raised hand reaches the host, who can lower everyone's.
    await controls(guest.page)
      .getByRole("button", { name: "Raise hand" })
      .click();
    await expect(
      controls(guest.page).getByRole("button", { name: "Lower hand" }),
    ).toBeVisible();
    await host.page
      .getByRole("button", { name: /participant/i })
      .first()
      .click();
    await host.page.getByRole("button", { name: "Lower all hands" }).click();
    await expect(
      controls(guest.page).getByRole("button", { name: "Raise hand" }),
    ).toBeVisible();

    // End meeting for all.
    await controls(host.page).getByRole("button", { name: "Leave" }).click();
    await host.page
      .getByRole("menuitem", { name: "End meeting for all" })
      .click();
    await expect(
      host.page.getByText("You ended the meeting for everyone"),
    ).toBeVisible();
    await expect(
      guest.page.getByText("The host ended the meeting"),
    ).toBeVisible();
    expectNoErrors(host, guest);
  });

  test("the host mutes a guest, then asks them to unmute", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    await openMeeting(host.page, meeting);
    await joinFromPreJoin(host.page);
    const guest = await people.guest();
    await openMeeting(guest.page, meeting);
    await joinFromPreJoin(guest.page, "Jordan Lee");

    const guestMic = (name: string) =>
      controls(guest.page).getByRole("button", { name, exact: true });
    await expect(guestMic("Mute")).toBeVisible();

    await host.page
      .getByRole("button", { name: "Options for Jordan Lee" })
      .first()
      .click();
    await host.page.getByRole("menuitem", { name: "Mute" }).click();
    await expect(guest.page.getByText("The host muted you")).toBeVisible();
    await expect(guestMic("Unmute")).toBeVisible();

    await host.page
      .getByRole("button", { name: "Options for Jordan Lee" })
      .first()
      .click();
    await host.page.getByRole("menuitem", { name: "Ask to unmute" }).click();
    const request = guest.page.getByRole("alertdialog");
    await request.getByRole("button", { name: "Unmute" }).click();
    await expect(guestMic("Mute")).toBeVisible();
    expectNoErrors(host, guest);
  });

  test("the waiting room: the host turns someone away, then lets them in", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id, { waitingRoom: true });
    await openMeeting(host.page, meeting);
    await joinFromPreJoin(host.page);

    const guest = await people.guest();
    await openMeeting(guest.page, meeting);
    await guest.page.getByLabel("Your name").fill("Jordan Lee");
    await guest.page.getByRole("button", { name: "Ask to join" }).click();
    await expect(
      guest.page.getByText("Waiting for the host to let you in"),
    ).toBeVisible();

    // Participants lists who's waiting, with Admit and Deny.
    await host.page
      .getByRole("button", { name: /participant/i })
      .first()
      .click();
    await host.page.getByRole("button", { name: "Deny Jordan Lee" }).click();
    await expect(
      guest.page.getByText("Someone in the meeting didn’t let you in."),
    ).toBeVisible();

    await guest.page.getByRole("button", { name: "Ask to join" }).click();
    await host.page.getByRole("button", { name: "Admit Jordan Lee" }).click();
    await expect(
      controls(guest.page).getByRole("button", { name: "Raise hand" }),
    ).toBeVisible({ timeout: 30_000 });
    expectNoErrors(host, guest);
  });
});
