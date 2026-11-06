import AxeBuilder from "@axe-core/playwright";
import { type Page } from "@playwright/test";

import { createMeeting, database } from "./support/db";
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
  // Both sign in as the test admin, so one at a time.
  test.describe.configure({ mode: "serial" });

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

  test("says when the latest call has no attendance, until one does", async ({
    people,
  }) => {
    test.skip(!hasStream, "Stream's row shows only where Stream is set up.");
    const admin = await people.signedIn({
      email: ADMIN_EMAIL,
      name: "Ada Admin",
    });
    const { page } = admin;
    // A three-minute call nobody's attendance came in for, ending after any other
    // test's call, so it's the latest whatever runs beside it.
    const meeting = await createMeeting(admin.user.id);
    const ended = new Date(Date.now() + 10 * 60_000);
    const started = new Date(ended.getTime() - 3 * 60_000);
    const { rows } = await database().query<{ id: string }>(
      `insert into meeting_session (meeting_id, provider, status, limits, started_at, ended_at, last_seen_at)
       values ($1, 'stream', 'ended', $2, $3, $4, $4) returning id`,
      [
        meeting.id,
        JSON.stringify({
          maxParticipants: 4,
          maxDurationSeconds: 900,
          demo: true,
        }),
        started,
        ended,
      ],
    );
    const missing = page.getByText(
      /^The latest call that ran a minute or more has no attendance/,
    );

    await page.goto("/settings/admin#usage");
    await expect(missing).toBeVisible();
    await expect(
      page.locator("#usage code", { hasText: "pnpm stream:check" }),
    ).toBeVisible();
    expect(await axeProblems(page)).toEqual([]);

    // Its attendance arrives: the warning goes.
    await database().query(
      `insert into participant_session (session_id, connection_id, media_user_id, user_id, display_name, joined_at, left_at)
       values ($1, $2, $3, $4, 'Ada Admin', $5, $6)`,
      [
        rows[0]?.id,
        `e2e-${meeting.code}`,
        `u_${admin.user.id}`,
        admin.user.id,
        started,
        ended,
      ],
    );
    await page.reload();
    await expect(
      page.getByRole("meter", { name: "Stream video minutes" }),
    ).toBeVisible();
    await expect(missing).toHaveCount(0);
    expectNoErrors(admin);
  });
});
