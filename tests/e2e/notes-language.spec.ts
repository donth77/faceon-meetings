import { readFileSync } from "node:fs";
import path from "node:path";

import type Portuguese from "../../messages/pt-BR.json";
import { standInForProviders } from "./support/ai-providers";
import { createMeeting, database } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";

/** The Portuguese messages (read, since Node won't import JSON without an attribute). */
const pt: typeof Portuguese = JSON.parse(
  readFileSync(path.join("messages", "pt-BR.json"), "utf8"),
);

/**
 * Chrome on a computer as far as FaceOn can tell, with a built-in AI that writes only
 * `writes` (Chrome's model doesn't write Portuguese yet) and speech recognition that
 * hears nothing, and Settings → AI notes as given.
 */
function chromeWhoseAiWrites(writes: string[], settings?: object): string {
  return `(() => {
    const writes = ${JSON.stringify(writes)};
    Object.defineProperty(navigator, "userAgentData", {
      get: () => ({
        brands: [{ brand: "Google Chrome", version: "141" }, { brand: "Chromium", version: "141" }],
        mobile: false,
        platform: "Windows",
        getHighEntropyValues: async () => ({}),
      }),
    });
    window.LanguageModel = {
      availability: async (options) =>
        writes.includes(options.expectedOutputs[0].languages[0]) ? "available" : "unavailable",
      create: async () => { throw new Error("Not in this test."); },
    };
    class Recognition {
      static async available() { return "available"; }
      static async install() { return true; }
      start() {}
      stop() { setTimeout(() => this.onend && this.onend(), 0); }
      abort() { setTimeout(() => this.onend && this.onend(), 0); }
    }
    window.SpeechRecognition = Recognition;
    ${settings ? `localStorage.setItem("faceon.aiNotes", ${JSON.stringify(JSON.stringify(settings))});` : ""}
  })();`;
}

const WRITES = ["en", "es", "ja", "de", "fr"];
/** The notice, as the Portuguese page words it. */
const IN_ENGLISH = pt.Notes.inEnglish.replaceAll(
  "{language}",
  new Intl.DisplayNames(["pt-BR"], { type: "language" }).of("pt-BR") ?? "",
);

test.describe("AI notes in a language Chrome's AI doesn't write", () => {
  test("Settings → AI notes says notes on this computer will be in English, and offers a key", async ({
    people,
  }) => {
    const host = await people.signedIn({ aiNotes: true });
    await host.context.addInitScript({ content: chromeWhoseAiWrites(WRITES) });
    await standInForProviders(host.context);

    // In English there's nothing to say but that notes here are free.
    await host.page.goto("/settings/ai-notes");
    await expect(
      host.page.getByText(
        "Free: notes are made on this computer. Only people using Chrome are transcribed.",
      ),
    ).toBeVisible();
    await expect(host.page.getByText(/can't write notes in/)).toHaveCount(0);

    // In Portuguese, notes on this computer would be in English: a key gives notes in
    // Portuguese.
    await host.page.goto("/settings/ai-notes?hl=pt-BR");
    await expect(host.page.getByText(pt.Notes.here.free)).toBeVisible();
    const notice = host.page.getByRole("note").filter({ hasText: IN_ENGLISH });
    await expect(notice).toBeVisible();
    await notice
      .getByRole("button", { name: pt.Settings.aiNotes.useOwnKey })
      .click();
    const key = host.page.getByLabel(pt.Settings.aiNotes.key, { exact: true });
    await expect(key).toBeFocused();
    await key.fill("sk-e2e-not-a-real-key");
    await expect(notice).toHaveCount(0);
    await expect(
      host.page.getByText(pt.Notes.here.writes.replace("{provider}", "OpenAI")),
    ).toBeVisible();
    expectNoErrors(host);
  });

  test("the AI notes panel says so as notes start, until put away on this device", async ({
    people,
  }) => {
    needsStream();
    test.setTimeout(120_000);
    const host = await people.signedIn({ name: "Notes Host", aiNotes: true });
    // Only full meetings offer AI notes.
    await database().query(
      `insert into host_allowlist (email, note) values ($1, 'e2e') on conflict do nothing`,
      [host.user.email.toLowerCase()],
    );
    try {
      const meeting = await createMeeting(host.user.id);
      await host.context.addInitScript({
        content: chromeWhoseAiWrites(WRITES, { engine: "onDevice" }),
      });
      await host.page.goto(
        `/j/${meeting.code}?hl=pt-BR#pwd=${meeting.passcode}`,
      );
      await host.page.getByRole("button", { name: pt.PreJoin.joinNow }).click();
      await expect(
        host.page.getByRole("button", { name: pt.Meeting.leave, exact: true }),
      ).toBeVisible({ timeout: 60_000 });
      await host.page
        .getByRole("button", { name: new RegExp(`^${pt.Meeting.more}`) })
        .click();
      await host.page
        .getByRole("menuitem", { name: pt.Meeting.notes.title })
        .click();
      await host.page
        .getByRole("button", { name: pt.Meeting.notes.start })
        .click();

      const notice = host.page
        .getByRole("status")
        .filter({ hasText: IN_ENGLISH });
      await expect(notice).toBeVisible();
      await notice
        .getByRole("button", { name: pt.Meeting.notes.gotIt })
        .click();
      await expect(notice).toHaveCount(0);
      expect(
        await host.page.evaluate(() =>
          localStorage.getItem("faceon.notesInEnglish"),
        ),
      ).toBe("dismissed");

      // Put away for good on this device: closing and opening the panel doesn't bring it back.
      await host.page
        .getByRole("button", { name: pt.Meeting.notes.close })
        .click();
      await host.page
        .getByRole("button", { name: new RegExp(`^${pt.Meeting.more}`) })
        .click();
      await host.page
        .getByRole("menuitem", { name: pt.Meeting.notes.title })
        .click();
      await expect(
        host.page.getByText(pt.Meeting.notes.youTakeNotes),
      ).toBeVisible();
      await expect(
        host.page.getByRole("status").filter({ hasText: IN_ENGLISH }),
      ).toHaveCount(0);
      expectNoErrors(host);
    } finally {
      await database().query(`delete from host_allowlist where email = $1`, [
        host.user.email.toLowerCase(),
      ]);
    }
  });
});
