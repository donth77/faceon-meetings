import type { Page } from "@playwright/test";

import { formatMeetingCode } from "@/lib/meetings/codes";

import { createMeeting, createScheduledMeeting } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";
import { joinFromPreJoin, openMeeting } from "./support/meeting";

/** A meeting's row on Home's Today or in Upcoming, by something it shows. */
const rowWith = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ hasText: text });

/** The meeting's control bar (Mute, Stop video, Leave…), not the tiles' buttons. */
const controls = (page: Page) => page.locator("footer");

test.describe("Live", () => {
  test.beforeEach(() => needsStream());

  test("someone invited sees the meeting as Live on Home and in Upcoming once the host starts it, until it ends", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const invitee = await people.signedIn({ name: "Jordan Lee" });
    const meeting = await createScheduledMeeting(host.user.id, {
      title: "Design review",
      invitees: [invitee.user.email],
    });

    await invitee.page.goto("/home");
    const today = rowWith(invitee.page, "Design review");
    await expect(today.getByRole("link", { name: "Join" })).toBeVisible();
    await expect(today.getByText("Live", { exact: true })).toHaveCount(0);

    await openMeeting(host.page, meeting);
    await joinFromPreJoin(host.page);

    await invitee.page.reload();
    await expect(today.getByText("Live", { exact: true })).toBeVisible();
    await expect(today.getByRole("link", { name: "Join" })).toHaveAttribute(
      "href",
      new RegExp(`/j/${meeting.code}`),
    );

    await invitee.page.goto("/upcoming");
    const upcoming = rowWith(invitee.page, "Design review");
    await expect(upcoming.getByText("Live", { exact: true })).toBeVisible();
    await expect(upcoming.getByRole("link", { name: "Join" })).toBeVisible();

    await controls(host.page).getByRole("button", { name: "Leave" }).click();
    await host.page
      .getByRole("menuitem", { name: "End meeting for all" })
      .click();
    await expect(
      host.page.getByText("You ended the meeting for everyone"),
    ).toBeVisible();
    await invitee.page.reload();
    await expect(upcoming.getByRole("link", { name: "Join" })).toBeVisible();
    await expect(upcoming.getByText("Live", { exact: true })).toHaveCount(0);
    expectNoErrors(host, invitee);
  });

  test("your own meeting that's running shows on Home as Live, with Join", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Maya Host" });
    const meeting = await createMeeting(host.user.id);
    // Started in another tab, as when someone left it running there.
    const call = await host.context.newPage();
    await openMeeting(call, meeting);
    await joinFromPreJoin(call);

    await host.page.goto("/home");
    const running = rowWith(host.page, formatMeetingCode(meeting.code));
    await expect(running.getByText("Maya’s meeting")).toBeVisible();
    await expect(running.getByText("Live", { exact: true })).toBeVisible();
    await expect(running.getByRole("link", { name: "Join" })).toHaveAttribute(
      "href",
      new RegExp(`/j/${meeting.code}`),
    );
    // The personal room isn't the one that's live.
    await expect(
      host.page.getByRole("heading", { name: "Personal room", exact: true }),
    ).toBeVisible();
    expectNoErrors(host);
  });
});
