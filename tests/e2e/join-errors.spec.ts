import { randomInt } from "node:crypto";

import {
  createMeeting,
  createUser,
  database,
  deleteUsers,
  resetAttempts,
} from "./support/db";
import { expect, expectNoErrors, hydrated, test } from "./support/fixtures";

test.describe("joining from the meeting ID field", () => {
  test.beforeEach(async () => {
    await resetAttempts();
  });

  test("each kind of mistake is explained under the field", async ({
    people,
    baseURL,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await page.goto("/");
    await hydrated(page.getByRole("button", { name: "Join" }));
    const field = page.getByLabel("Enter a meeting ID or link");
    const join = page.getByRole("button", { name: "Join" });
    const cases: Array<[string, RegExp]> = [
      ["12345", /A meeting ID has 10 digits/],
      ["hello there", /Enter a meeting ID, like .*, or paste a meeting link/],
      ["https://zoom.us/j/1234567890", /That link is for another site/],
      [`${baseURL}/help`, /That link isn.t to a meeting/],
      [`${baseURL}/j/12345`, /That link.s meeting ID isn.t complete/],
    ];
    for (const [input, message] of cases) {
      await field.fill(input);
      await join.click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        message,
      );
      // The text and the focus stay, so it can be fixed in place.
      await expect(field).toBeFocused();
      await expect(field).toHaveValue(input);
      await expect(field).toHaveAttribute("aria-invalid", "true");
    }
    expectNoErrors(visitor);
  });

  test("a meeting that doesn't exist, or has ended, is caught before leaving the page", async ({
    people,
  }) => {
    const host = await createUser();
    try {
      const ended = await createMeeting(host.id);
      await database().query(
        `update meeting set status = 'ended' where id = $1`,
        [ended.id],
      );
      const visitor = await people.guest();
      const { page } = visitor;
      await page.goto("/");
      await hydrated(page.getByRole("button", { name: "Join" }));
      const field = page.getByLabel("Enter a meeting ID or link");
      const join = page.getByRole("button", { name: "Join" });

      await field.fill(String(randomInt(1_000_000_000, 9_999_999_999)));
      await join.click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        /There.s no meeting with that ID/,
      );
      await expect(page).toHaveURL(/\/$/);

      await field.fill(ended.code);
      await join.click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        /That meeting has ended/,
      );
      expectNoErrors(visitor);
    } finally {
      await deleteUsers([host.id]);
    }
  });

  test("a meeting that's on opens its page, with the passcode from the link", async ({
    people,
    baseURL,
  }) => {
    const host = await createUser();
    try {
      const meeting = await createMeeting(host.id);
      const visitor = await people.guest();
      const { page } = visitor;
      await page.goto("/");
      await hydrated(page.getByRole("button", { name: "Join" }));
      await page
        .getByLabel("Enter a meeting ID or link")
        .fill(`${baseURL}/j/${meeting.code}#pwd=${meeting.passcode}`);
      await page.getByRole("button", { name: "Join" }).click();
      await expect(page).toHaveURL(new RegExp(`/j/${meeting.code}`));
      await expect(page.getByLabel("Your name")).toBeVisible();
      expectNoErrors(visitor);
    } finally {
      await deleteUsers([host.id]);
    }
  });
});
