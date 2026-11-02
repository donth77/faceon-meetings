import { database } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

const SECTIONS = [
  ["/settings", "General"],
  ["/settings/audio", "Audio"],
  ["/settings/video", "Video"],
  ["/settings/effects", "Backgrounds and effects"],
  ["/settings/notifications", "Notifications"],
  ["/settings/reactions", "Reactions"],
  ["/settings/accessibility", "Accessibility"],
  ["/settings/ai-notes", "AI notes"],
  ["/settings/calendar", "Calendar"],
  ["/settings/account", "Account"],
] as const;

test.describe("Settings", () => {
  test("every section opens", async ({ people }) => {
    const host = await people.signedIn();
    const { page } = host;
    for (const [path, title] of SECTIONS) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 2, name: title }),
        path,
      ).toBeVisible();
    }
    expectNoErrors(host);
  });

  test("Admin is only for admins", async ({ people }) => {
    const person = await people.signedIn();
    const { page } = person;
    await page.goto("/settings");
    const sections = page.getByRole("navigation", {
      name: "Settings sections",
    });
    await expect(sections.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(sections.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await page.goto("/settings/admin");
    await expect(page.getByText("Page not found")).toBeVisible();
    expectNoErrors(person);
  });

  test("a choice made here is kept on this device", async ({ people }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/settings");
    const hours24 = page.getByRole("radio", { name: /24-hour/ });
    await page.locator("label", { has: hours24 }).click();
    await expect(hours24).toBeChecked();
    await page.reload();
    await expect(page.getByRole("radio", { name: /24-hour/ })).toBeChecked();
    expectNoErrors(host);
  });

  test("AI notes are off until the host turns them on, and the choice is kept with the account", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    await page.goto("/settings/ai-notes");
    const allow = page.getByRole("switch", {
      name: "AI notes in meetings you host",
    });
    await expect(allow).not.toBeChecked();
    await page.locator("label", { has: allow }).click();
    await expect(allow).toBeChecked();
    await expect
      .poll(async () => {
        const { rows } = await database().query<{ ai_notes: boolean }>(
          `select ai_notes from "user" where id = $1`,
          [host.user.id],
        );
        return rows[0]?.ai_notes;
      })
      .toBe(true);
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "AI notes in meetings you host" }),
    ).toBeChecked();
    expectNoErrors(host);
  });
});
