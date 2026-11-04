import { unzipSync } from "fflate";

import { createPastMeeting, database, sessionOf } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

/** Text as it was sent, keeping a CSV's byte-order mark. */
const text = (bytes: Uint8Array) =>
  new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

/** AI notes saved to a past session by its host, with their transcript. */
async function saveNotes(sessionId: string, hostId: string): Promise<void> {
  await database().query(
    `insert into meeting_notes (session_id, saved_by, notes, transcript, engine, made_at)
     values ($1, $2, $3, $4, 'onDevice', now())`,
    [
      sessionId,
      hostId,
      JSON.stringify({
        summary: "We picked the launch date.",
        actionItems: [],
        decisions: ["Launch on Friday"],
      }),
      "Hana Host (15:00): Friday works.",
    ],
  );
}

test.describe("exports", () => {
  test("a meeting's Download menu: attendance for its host, and the AI notes with their transcript", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Hana Host" });
    const meeting = await createPastMeeting(host.user, {
      minutes: 30,
      guestName: "=Guest",
    });
    const sessionId = await sessionOf(meeting.id);
    await saveNotes(sessionId, host.user.id);
    const { page } = host;
    await page.goto("/previous");

    // The row says notes and a transcript were saved, and leads to them.
    const notesLink = page.getByRole("link", {
      name: /^AI notes and transcript for /,
    });
    await expect(notesLink).toHaveAttribute(
      "href",
      `/previous/${sessionId}/notes`,
    );

    await page
      .getByRole("button", { name: /View details/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Download", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: "Attendance (CSV)" }),
    ).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("menuitem", { name: "AI notes and transcript (Markdown)" })
        .click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/AI notes\.md$/);

    // The files as the server makes them, read through the host's own sign-in.
    const notes = await host.context.request.get(
      `/api/history/${sessionId}/notes?tz=America/New_York`,
    );
    expect(notes.status()).toBe(200);
    const markdown = text(await notes.body());
    expect(markdown).toContain("We picked the launch date.");
    expect(markdown).toContain("Hana Host (15:00): Friday works.");

    const attendance = await host.context.request.get(
      `/api/history/${sessionId}/attendance?tz=America/New_York`,
    );
    const csv = text(await attendance.body());
    expect(csv.startsWith("﻿Name,Email,Joined as,")).toBe(true);
    expect(csv).toContain(`Hana Host,${host.user.email},Host,`);
    // A guest's name that looks like a formula stays text, with no address.
    expect(csv).toContain("'=Guest,,Guest,");

    // Someone who wasn't there gets neither.
    const stranger = await people.signedIn();
    for (const file of ["attendance", "notes"]) {
      const refused = await stranger.context.request.get(
        `/api/history/${sessionId}/${file}`,
      );
      expect(refused.status()).toBe(404);
    }
    expectNoErrors(host);
  });

  test("Download history gives every meeting, the attendance and the notes in one zip", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Hana Host" });
    const meeting = await createPastMeeting(host.user, {
      minutes: 45,
      guestName: "Gil Guest",
    });
    await saveNotes(await sessionOf(meeting.id), host.user.id);
    const { page } = host;
    await page.goto("/previous");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download history" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/history .*\.zip$/);

    const response = await host.context.request.get(
      "/api/history/export?tz=America/New_York",
    );
    expect(response.status()).toBe(200);
    const files = unzipSync(new Uint8Array(await response.body()));
    const names = Object.keys(files);
    expect(names).toEqual(
      expect.arrayContaining(["README.md", "history.csv", "attendance.csv"]),
    );
    expect(names.some((name) => /^notes\/.+\.md$/.test(name))).toBe(true);
    expect(text(files["history.csv"] ?? new Uint8Array())).toContain(
      ",Hana Host,Host,45,2",
    );
    expect(text(files["attendance.csv"] ?? new Uint8Array())).toContain(
      "Gil Guest,,Guest,",
    );
    expectNoErrors(host);
  });

  test("Download your data gives a zip of everything, with a README", async ({
    people,
  }) => {
    const host = await people.signedIn();
    await createPastMeeting(host.user, { minutes: 20, guestName: "Gil Guest" });
    const { page } = host;
    await page.goto("/settings/account");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download your data" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    const response = await host.context.request.get(
      "/api/account/export?tz=America/New_York",
    );
    expect(response.status()).toBe(200);
    const files = unzipSync(new Uint8Array(await response.body()));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "README.md",
        "account.json",
        "hosting.json",
        "meetings.json",
        "meetings.csv",
        "previous.json",
        "previous.csv",
        "notes.json",
      ]),
    );
    const account = JSON.parse(text(files["account.json"] ?? new Uint8Array()));
    expect(account.email).toBe(host.user.email);
    expect(text(files["previous.csv"] ?? new Uint8Array())).toContain(
      "Gil Guest,,Guest,",
    );
    expectNoErrors(host);
  });
});
