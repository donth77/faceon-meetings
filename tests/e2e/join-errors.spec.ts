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
    // What's typed, what the field then shows (digits are grouped as they're typed), and
    // what it says.
    const cases: Array<[string, string, RegExp]> = [
      ["12345", "123 45", /A meeting ID has 10 digits/],
      [
        "hello there",
        "hello there",
        /Enter a meeting ID, like .*, or paste a meeting link/,
      ],
      [
        "https://zoom.us/j/1234567890",
        "https://zoom.us/j/1234567890",
        /That link is for another site/,
      ],
      [`${baseURL}/help`, `${baseURL}/help`, /That link isn.t to a meeting/],
      [
        `${baseURL}/j/12345`,
        `${baseURL}/j/12345`,
        /That link.s meeting ID isn.t complete/,
      ],
    ];
    for (const [input, shown, message] of cases) {
      await field.fill(input);
      await join.click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        message,
      );
      // The text and the focus stay, so it can be fixed in place.
      await expect(field).toBeFocused();
      await expect(field).toHaveValue(shown);
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

test.describe("failed joins", () => {
  test.beforeEach(async () => {
    await resetAttempts();
  });

  test("other people's wrong passcodes never keep a meeting's host out", async ({
    people,
    playwright,
    baseURL,
  }) => {
    const { page, user } = await people.signedIn();
    const meeting = await createMeeting(user.id);
    const api = await playwright.request.newContext({ baseURL });
    const join = (address: string, passcode: string) =>
      api.post(`/api/meetings/${meeting.code}/join`, {
        headers: { "x-forwarded-for": address, origin: baseURL ?? "" },
        data: { name: "Someone", passcode },
      });
    try {
      // Twenty wrong passcodes, from two addresses: the meeting's limit.
      for (const address of ["198.51.100.7", "198.51.100.8"]) {
        for (let attempt = 0; attempt < 10; attempt++) {
          expect((await join(address, "WRONG1")).status()).toBe(403);
        }
      }
      // A newcomer without an account waits now: this build has no check for a person.
      expect((await join("198.51.100.9", meeting.passcode)).status()).toBe(429);
      // The host still gets past the limits.
      const host = await page.request.post(
        `/api/meetings/${meeting.code}/join`,
        { headers: { origin: baseURL ?? "" }, data: { name: user.name } },
      );
      expect(host.status()).not.toBe(429);
    } finally {
      await api.dispose();
    }
  });
});
