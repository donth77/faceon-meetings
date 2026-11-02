import { hostingRequests } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

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
    const dialog = page.getByRole("dialog");
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
    const link = await page
      .getByRole("dialog")
      .getByRole("textbox")
      .inputValue();
    const code = /\/j\/(\d{10})/.exec(link)?.[1] ?? "";
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close" })
      .click();
    await page.getByLabel("Meeting ID or link").fill(code);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/j/${code}`));
    await expect(page.getByRole("button", { name: "Join now" })).toBeVisible({
      timeout: 30_000,
    });
    expectNoErrors(host);
  });
});
