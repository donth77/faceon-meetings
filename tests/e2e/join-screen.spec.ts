import { type Page } from "@playwright/test";

import { createMeeting, createPastMeeting } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";
import { joinFromPreJoin, openMeeting } from "./support/meeting";

/** The avatar beside the name on the join screen. */
const changeAvatar = (page: Page) =>
  page.getByRole("button", { name: "Change avatar" });
const avatarSrc = (page: Page) =>
  changeAvatar(page).locator("img").getAttribute("src");

/** Picks an avatar in the open "Your avatar" dialog, and returns its picture. */
async function pickAvatar(page: Page, n: number): Promise<string> {
  const dialog = page.getByRole("dialog", { name: "Your avatar" });
  const option = dialog
    .getByRole("radio", { name: `Avatar option ${n}` })
    .locator("xpath=ancestor::label");
  const src = await option.locator("img").getAttribute("src");
  await option.click();
  await dialog.getByRole("button", { name: "Done" }).click();
  if (!src) throw new Error("The avatar option has no picture.");
  return src;
}

const waitingForHost = (page: Page) =>
  page.getByText("The host hasn’t started this meeting yet.").first();

test.describe("the join screen's passcode", () => {
  test("asked up front when the link doesn't bring it, and wrong only once one is tried", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    // It waits for its host, so the right passcode leads to waiting for them.
    const meeting = await createMeeting(host.user.id, {
      joinBeforeHost: false,
    });
    const guest = await people.guest();
    const { page } = guest;
    await page.goto(`/j/${meeting.code}`);

    const passcode = page.getByLabel("Passcode");
    await expect(passcode).toBeVisible();
    await expect(passcode).toHaveAccessibleDescription(
      "It’s in the meeting invitation.",
    );
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toHaveCount(0);
    await page.getByLabel("Your name").fill("Jordan Lee");
    const joinNow = page.getByRole("button", { name: "Join now" });
    await expect(joinNow).toBeDisabled();

    await passcode.fill("WRONG1");
    await joinNow.click();
    await expect(alert).toHaveText(/That passcode isn’t right/);
    await expect(passcode).toBeFocused();
    await expect(passcode).toHaveAttribute("aria-invalid", "true");

    await passcode.fill(meeting.passcode);
    await joinNow.click();
    await expect(waitingForHost(page)).toBeVisible();
    expectNoErrors(guest);
  });

  test("not asked when the link brings it, nor of the meeting's host", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id, {
      joinBeforeHost: false,
    });

    const guest = await people.guest();
    await openMeeting(guest.page, meeting);
    await expect(guest.page.getByLabel("Your name")).toBeVisible();
    await expect(guest.page.getByLabel("Passcode")).toHaveCount(0);
    await guest.page.getByLabel("Your name").fill("Jordan Lee");
    await guest.page.getByRole("button", { name: "Join now" }).click();
    await expect(waitingForHost(guest.page)).toBeVisible();

    await host.page.goto(`/j/${meeting.code}`);
    await expect(host.page.getByLabel("Your name")).toBeVisible();
    await expect(host.page.getByLabel("Passcode")).toHaveCount(0);
    expectNoErrors(guest, host);
  });
});

test.describe("the join screen's avatar", () => {
  test("a first-time guest's follows their name until they pick one, and comes back next time", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id, {
      joinBeforeHost: false,
    });
    const guest = await people.guest();
    const { page } = guest;
    await openMeeting(page, meeting);

    const first = await avatarSrc(page);
    expect(first).toMatch(/^\/avatar\/[a-z0-9]{16}-n\.svg$/);
    await page.getByLabel("Your name").fill("Maria Lopez");
    // The same face's random part, with the look the name suggests.
    await expect(changeAvatar(page).locator("img")).toHaveAttribute(
      "src",
      (first ?? "").replace("-n.svg", "-f.svg"),
    );

    await changeAvatar(page).click();
    const chosen = await pickAvatar(page, 3);
    await expect(changeAvatar(page)).toBeFocused();
    await expect(changeAvatar(page).locator("img")).toHaveAttribute(
      "src",
      chosen,
    );
    // Chosen, it stays put whatever name comes next.
    await page.getByLabel("Your name").fill("Ben Okafor");
    await page.waitForTimeout(1000);
    expect(await avatarSrc(page)).toBe(chosen);

    await page.getByRole("button", { name: "Join now" }).click();
    await expect(waitingForHost(page)).toBeVisible();
    // This browser's guest cookie keeps it for the next visit.
    await openMeeting(page, meeting);
    await expect(changeAvatar(page).locator("img")).toHaveAttribute(
      "src",
      chosen,
    );
    expectNoErrors(guest);
  });

  test("a signed-in person's choice is saved to their account", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    const person = await people.signedIn({ name: "Ana López" });
    const { page } = person;
    await openMeeting(page, meeting);
    await changeAvatar(page).click();
    await expect(
      page
        .getByRole("dialog", { name: "Your avatar" })
        .getByText("It’s saved to your account."),
    ).toBeVisible();
    // The choice is saved as it's made: a server action from the join screen.
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        Boolean(response.request().headers()["next-action"]),
    );
    const chosen = await pickAvatar(page, 2);
    await expect(changeAvatar(page).locator("img")).toHaveAttribute(
      "src",
      chosen,
    );
    await saved;

    await page.goto("/settings/account");
    await expect(page.locator(`img[src="${chosen}"]`).first()).toBeVisible();
    expectNoErrors(person);
  });

  test("the room shows a guest with the avatar the join screen showed", async ({
    people,
  }) => {
    needsStream();
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    await openMeeting(host.page, meeting);
    await joinFromPreJoin(host.page);

    const guest = await people.guest();
    await openMeeting(guest.page, meeting);
    await guest.page.getByLabel("Your name").fill("Jordan Lee");
    await changeAvatar(guest.page).click();
    const chosen = await pickAvatar(guest.page, 4);
    await joinFromPreJoin(guest.page);

    await host.page
      .getByRole("button", { name: /participant/i })
      .first()
      .click();
    const row = host.page
      .getByRole("listitem")
      .filter({ hasText: "Jordan Lee" });
    await expect(row.locator("img").first()).toHaveAttribute(
      "src",
      new RegExp(`${chosen.replace(".", "\\.")}$`),
    );
    expectNoErrors(host, guest);
  });
});

test.describe("the join screen's Settings", () => {
  test("open before joining and while waiting, and what's chosen there stays", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id, {
      joinBeforeHost: false,
    });
    const guest = await people.guest();
    const { page } = guest;
    await openMeeting(page, meeting);

    const settings = page.getByRole("button", { name: "Settings" });
    await settings.click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(
      dialog.getByRole("tab", { name: "Audio", selected: true }),
    ).toBeVisible();
    await expect(dialog.getByText("Noise suppression").first()).toBeVisible();
    const pushToTalk = page.getByRole("switch", { name: /Push to talk/ });
    await page.locator("label", { has: pushToTalk }).click();
    await expect(pushToTalk).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(settings).toBeFocused();

    // Waiting for the host, Settings is still there, as it was left.
    await page.getByLabel("Your name").fill("Jordan Lee");
    await page.getByRole("button", { name: "Join now" }).click();
    await expect(waitingForHost(page)).toBeVisible();
    await settings.click();
    await expect(
      dialog.getByRole("switch", { name: /Push to talk/ }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    expectNoErrors(guest);
  });

  test("its General has the language before joining, and the header doesn't", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id, {
      joinBeforeHost: false,
    });
    const guest = await people.guest();
    const { page } = guest;
    await openMeeting(page, meeting);
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(header.getByRole("button")).toHaveCount(0);

    const settings = page.getByRole("button", { name: "Settings" });
    const dialog = page.getByRole("dialog", { name: "Settings" });
    const language = dialog.getByRole("button", { name: /Language/ });
    await settings.click();
    await dialog.getByRole("tab", { name: "General" }).click();
    await expect(language).toBeVisible();
    await expect(language).toContainText("English");
    await page.keyboard.press("Escape");

    // Asked to join, a new language would reload the page and lose your place.
    await page.getByLabel("Your name").fill("Jordan Lee");
    await page.getByRole("button", { name: "Join now" }).click();
    await expect(waitingForHost(page)).toBeVisible();
    await settings.click();
    await dialog.getByRole("tab", { name: "General" }).click();
    await expect(dialog.getByText("Time format")).toBeVisible();
    await expect(language).toHaveCount(0);
    await page.keyboard.press("Escape");
    expectNoErrors(guest);
  });

  test("its dialogs fit a phone, in the dark theme too", async ({ people }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    const guest = await people.guest({ viewport: { width: 375, height: 812 } });
    const { page } = guest;
    await page.emulateMedia({ colorScheme: "dark" });
    await openMeeting(page, meeting);

    const fits = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
    expect(await fits()).toBe(true);

    await changeAvatar(page).click();
    const avatars = page.getByRole("dialog", { name: "Your avatar" });
    await expect(avatars).toBeVisible();
    const box = await avatars.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
    await page.keyboard.press("Escape");
    await expect(changeAvatar(page)).toBeFocused();

    await page.getByRole("button", { name: "Settings" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    const sbox = await settings.boundingBox();
    expect(sbox && sbox.x >= 0 && sbox.x + sbox.width <= 375).toBe(true);
    await page.keyboard.press("Escape");
    expect(await fits()).toBe(true);
    expectNoErrors(guest);
  });
});

test.describe("Previous's attendees", () => {
  test("each named on hover, and everyone for the keyboard and screen readers", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    await createPastMeeting(host.user, {
      minutes: 30,
      guestName: "Jordan Lee",
    });
    const { page } = host;
    await page.goto("/previous");

    const group = page.getByRole("img", {
      name: /^2 people: (Maya Host and Jordan Lee|Jordan Lee and Maya Host)$/,
    });
    await expect(group).toBeVisible();

    await page.mouse.move(10, 10);
    await group.locator('[aria-label="Jordan Lee"]').hover();
    await expect(page.getByRole("tooltip")).toHaveText("Jordan Lee");
    await page.mouse.move(0, 0);
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    // One tab stop for the group: reached with Tab, it lists everyone.
    await page.getByRole("searchbox", { name: "Search" }).focus();
    for (let presses = 0; presses < 10; presses++) {
      await page.keyboard.press("Tab");
      if (await group.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(group).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText(
      /^(Maya Host and Jordan Lee|Jordan Lee and Maya Host)$/,
    );
    expectNoErrors(host);
  });
});
