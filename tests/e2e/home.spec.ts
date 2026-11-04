import type { Page } from "@playwright/test";

import { hostingRequests } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

/**
 * The "for later" link dialog, by name: the New meeting menu it opens from is a dialog
 * too (React Aria's popover) while it fades out, and the server can answer first.
 */
const linkDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Here’s the link to your meeting" });

test.describe("Home", () => {
  test("shows the time, New meeting and the join field, and says demo meetings are short", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/home");
    await expect(
      page.getByRole("button", { name: /New meeting/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Meeting ID or link")).toBeVisible();
    // A new account hosts demo meetings, and is told so.
    await expect(
      page.getByText(/Your meetings are demos for now/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Personal room" }),
    ).toBeVisible();
    expectNoErrors(host);
  });

  test("a demo host can ask to host full meetings", async ({ people }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/home");
    const ask = page.getByRole("button", { name: "Ask for full meetings" });
    await ask.click();
    const dialog = page.getByRole("dialog", {
      name: "Ask to host full meetings",
    });
    await dialog
      .getByRole("textbox", { name: /Note for the admins/ })
      .fill("Weekly team calls");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText(/Request sent/)).toBeVisible();
    await expect(dialog).toBeHidden();
    // The note now says where the request stands, with nothing left to ask.
    await expect(
      page.getByText(/You asked to host full meetings/),
    ).toBeVisible();
    await expect(ask).toHaveCount(0);
    expect(await hostingRequests(host.user.id)).toEqual([
      { status: "pending", note: "Weekly team calls" },
    ]);
    expectNoErrors(host);
  });

  test("New meeting can make a meeting for later and share its link", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/home");
    await page.getByRole("button", { name: /New meeting/ }).click();
    await expect(
      page.getByRole("menuitem", { name: /instant meeting/ }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: /for later/ }).click();
    const dialog = linkDialog(page);
    await expect(dialog).toBeVisible();
    const link = await dialog.getByRole("textbox").inputValue();
    expect(link).toMatch(/\/j\/\d{10}/);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    expectNoErrors(host);
  });

  test("the join field opens a meeting's page", async ({ people }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/home");
    await page.getByRole("button", { name: /New meeting/ }).click();
    await page.getByRole("menuitem", { name: /for later/ }).click();
    const link = await linkDialog(page).getByRole("textbox").inputValue();
    const code = /\/j\/(\d{10})/.exec(link)?.[1] ?? "";
    await linkDialog(page).getByRole("button", { name: "Close" }).click();
    await page.getByLabel("Meeting ID or link").fill(code);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/j/${code}`));
    await expect(page.getByRole("button", { name: "Join now" })).toBeVisible({
      timeout: 30_000,
    });
    expectNoErrors(host);
  });

  test("the join field groups an ID as it's typed", async ({ people }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/home");
    await page.getByRole("button", { name: /New meeting/ }).click();
    await page.getByRole("menuitem", { name: /for later/ }).click();
    const link = await linkDialog(page).getByRole("textbox").inputValue();
    const code = /\/j\/(\d{10})/.exec(link)?.[1] ?? "";
    await linkDialog(page).getByRole("button", { name: "Close" }).click();
    const grouped = (digits: string) =>
      [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
        .filter(Boolean)
        .join(" ");

    const field = page.getByLabel("Meeting ID or link");
    await field.pressSequentially(code.slice(0, 4));
    await expect(field).toHaveValue(grouped(code.slice(0, 4)));
    await field.pressSequentially(code.slice(4));
    await expect(field).toHaveValue(grouped(code));

    // Backspace just after a space takes the digit before it; typing it puts it back.
    for (let step = 0; step < 4; step += 1) await field.press("ArrowLeft");
    await field.press("Backspace");
    await expect(field).toHaveValue(grouped(code.slice(0, 5) + code.slice(6)));
    await field.pressSequentially(code.charAt(5));
    await expect(field).toHaveValue(grouped(code));

    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/j/${code}`));
    expectNoErrors(host);
  });
});
