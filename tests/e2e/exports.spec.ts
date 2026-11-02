import { unzipSync } from "fflate";

import { createPastMeeting, database } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

/** Text as it was sent, keeping a CSV's byte-order mark. */
const text = (bytes: Uint8Array) =>
  new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

async function sessionOf(meetingId: string): Promise<string> {
  const { rows } = await database().query<{ id: string }>(
    `select id from meeting_session where meeting_id = $1`,
    [meetingId],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("The test session wasn't found.");
  return id;
}

test.describe("exports", () => {
  test("a host downloads a past meeting's attendance, and nobody else can", async ({
    people,
  }) => {
    const host = await people.signedIn({ name: "Hana Host" });
    const meeting = await createPastMeeting(host.user, {
      minutes: 30,
      guestName: "=Guest",
    });
    const sessionId = await sessionOf(meeting.id);
    const { page } = host;
    await page.goto("/previous");
    await page
      .getByRole("button", { name: /View details/ })
      .first()
      .click();
    const button = page.getByRole("button", {
      name: "Download attendance (CSV)",
    });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      button.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/attendance\.csv$/);

    // The same file, read through the host's own sign-in.
    const response = await host.context.request.get(
      `/api/history/${sessionId}/attendance?tz=America/New_York`,
    );
    expect(response.status()).toBe(200);
    const csv = text(await response.body());
    expect(csv.startsWith("﻿Name,Email,Joined as,")).toBe(true);
    expect(csv).toContain(`Hana Host,${host.user.email},Host,`);
    // A guest's name that looks like a formula stays text, with no address.
    expect(csv).toContain("'=Guest,,Guest,");

    const stranger = await people.signedIn();
    const refused = await stranger.context.request.get(
      `/api/history/${sessionId}/attendance`,
    );
    expect(refused.status()).toBe(404);
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
