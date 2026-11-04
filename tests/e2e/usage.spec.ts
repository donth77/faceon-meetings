import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";

import { ADMIN_EMAIL, hasStream } from "./support/env";
import { expect, expectNoErrors, test } from "./support/fixtures";

/** Serious and critical WCAG 2.x A and AA problems axe finds in the usage card. */
async function axeProblems(page: Page) {
  const results = await new AxeBuilder({ page })
    .include("#usage")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
}

test.describe("Settings → Admin → Usage this month", () => {
  test("admins see each free allowance last, in both themes and on a phone", async ({
    people,
  }) => {
    const admin = await people.signedIn({
      email: ADMIN_EMAIL,
      name: "Ada Admin",
    });
    const { page } = admin;
    await page.goto("/settings/admin#usage");
    const usage = page.locator("#usage");
    // The last section, so a warning's link (#usage) brings it into view.
    const heading = usage.getByRole("heading", { name: "Usage this month" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
    await expect(page.locator("#usage ~ section")).toHaveCount(0);
    await expect(page.locator("section:has(h3) ~ #usage")).toHaveCount(1);
    // Most critical first: calls, then the database and hosting, then emails.
    await expect(usage.getByRole("heading", { level: 4 })).toHaveText([
      "Stream video minutes",
      "Database compute (Neon)",
      "Hosting (Vercel)",
      "Emails",
    ]);

    // Stream: a meter where Stream is set up, saying how much of the month's minutes.
    if (hasStream) {
      const minutes = usage.getByRole("meter", {
        name: "Stream video minutes",
      });
      await expect(minutes).toHaveAttribute(
        "aria-valuetext",
        /^[\d,]+ of 333,000 participant-minutes, /,
      );
      await expect(minutes).toHaveAttribute("aria-valuemax", "333000");
      // Each figure says when it was last updated.
      await expect(usage.getByText(/^Updated .+\.$/).first()).toBeVisible();
    } else {
      await expect(
        usage.getByText("Stream isn’t set up, so there are no calls to count."),
      ).toBeVisible();
    }

    // The tests' server sends no email and has no Neon key: each says so, and how.
    await expect(
      usage.getByText("Resend isn’t set up, so FaceOn sends no email."),
    ).toBeVisible();
    await expect(
      usage.getByText(/create a project-scoped API key in Neon’s console/),
    ).toBeVisible();
    const neon = usage.getByRole("link", { name: /Open Neon’s console/ });
    await expect(neon).toHaveAttribute("target", "_blank");
    await expect(neon).toHaveAccessibleName(
      "Open Neon’s console (opens in a new tab)",
    );

    // Vercel warns by email itself; the card links to its usage page.
    const vercel = usage.getByRole("link", {
      name: /Open Vercel’s usage page/,
    });
    await expect(vercel).toHaveAttribute("href", /^https:\/\/vercel\.com\//);
    await vercel.focus();
    await expect(vercel).toBeFocused();

    expect(await axeProblems(page)).toEqual([]);
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await axeProblems(page)).toEqual([]);

    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expectNoErrors(admin);
  });
});
