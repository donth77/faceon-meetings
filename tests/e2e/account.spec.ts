import { createMeeting, userExists } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

test.describe("deleting an account", () => {
  test("removes the account and its meetings, and signs out", async ({
    people,
  }) => {
    const person = await people.signedIn();
    await createMeeting(person.user.id);
    const { page } = person;
    await page.goto("/settings/account");
    await page.getByRole("button", { name: "Delete account" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Delete account" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect.poll(() => userExists(person.user.id)).toBe(false);

    // The old session no longer opens anything signed in.
    await page.goto("/home");
    await expect(page).toHaveURL(/\/sign-in/);
    expectNoErrors(person);
  });

  test("an old sign-in has to sign in again first", async ({ people }) => {
    const person = await people.signedIn({ signedInAgo: "2 days" });
    const { page } = person;
    await page.goto("/settings/account");
    await page.getByRole("button", { name: "Delete account" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Delete account" }).click();
    await expect(
      confirm.getByRole("button", { name: "Sign in again" }),
    ).toBeVisible();
    expect(await userExists(person.user.id)).toBe(true);
    expectNoErrors(person);
  });
});
