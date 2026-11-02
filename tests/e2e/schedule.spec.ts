import { createPastMeeting } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

test.describe("scheduling", () => {
  test("a one-off meeting with an invitee shows in Upcoming", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/schedule");
    await expect(
      page.getByRole("heading", { name: "Schedule a meeting" }),
    ).toBeVisible();
    await page.getByLabel("Title").fill("Design review");
    const invite = page.getByLabel("Invite people");
    await invite.fill("ben@example.com");
    await invite.press("Enter");
    await expect(page.getByText("ben@example.com")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("heading", { name: "Meeting scheduled" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(
      page.getByRole("heading", { name: "Design review" }),
    ).toBeVisible();
    await expect(page.getByText("Invited (1)")).toBeVisible();

    await page.goto("/upcoming");
    await expect(page.getByText("Design review").first()).toBeVisible();
    expectNoErrors(host);
  });

  test("a weekly series: one meeting moves, then the whole series goes", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/schedule");
    await page.getByLabel("Title").fill("Weekly sync");
    await page.getByRole("button", { name: /Repeat/ }).click();
    await page.getByRole("option", { name: /^Weekly on/ }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("heading", { name: "Meeting scheduled" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(
      page.getByRole("heading", { name: "Weekly sync" }),
    ).toBeVisible();
    const details = page.url();

    // Move one meeting: "This meeting" changes only that one.
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit meeting" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Start time/ }).click();
    await page.getByRole("option", { name: "11:45 PM" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    const scope = page.getByRole("dialog", { name: "Edit recurring meeting" });
    await scope.getByRole("button", { name: "OK" }).click();
    await page.waitForURL(details);
    await expect(page.getByText("moved").first()).toBeVisible();

    // Delete all of them.
    await page.getByRole("button", { name: "Delete" }).click();
    const remove = page.getByRole("dialog", {
      name: "Delete recurring meeting",
    });
    // `has` looks inside each label, so it's given a locator rooted at the page.
    const all = page.getByRole("radio", { name: "All meetings" });
    await remove.locator("label", { has: all }).click();
    await expect(all).toBeChecked();
    await remove.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL("**/upcoming");
    await expect(page.getByText("Nothing scheduled")).toBeVisible();
    await expect(
      page.getByText("Weekly sync").filter({ visible: true }),
    ).toHaveCount(0);
    expectNoErrors(host);
  });

  test("Previous shows a past meeting's length and who came", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    await createPastMeeting(host.user, {
      minutes: 75,
      guestName: "Jordan Lee",
    });
    const { page } = host;
    await page.goto("/previous");
    await expect(page.getByText("1 hr, 15 min").first()).toBeVisible();
    await page.getByRole("button", { name: "View details" }).first().click();
    await expect(page.getByText("Jordan Lee").first()).toBeVisible();
    expectNoErrors(host);
  });
});
