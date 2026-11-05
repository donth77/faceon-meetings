import { REFUSED, standInForProviders } from "./support/ai-providers";
import { createMeeting, database } from "./support/db";
import { expect, expectNoErrors, needsStream, test } from "./support/fixtures";
import { joinFromPreJoin, openMeeting } from "./support/meeting";

/** A browser like Safari or Firefox: no Chrome built-in AI, whatever this Chromium has. */
const NO_BUILT_IN_AI = `Object.defineProperty(globalThis, "LanguageModel", { value: undefined, configurable: true });`;

/**
 * Chrome on a computer as far as FaceOn can tell, whose built-in AI is ready, and whose
 * speech recognition is a stand-in that hears nothing.
 */
const CHROME_WITH_AI = `(() => {
  Object.defineProperty(navigator, "userAgentData", {
    get: () => ({
      brands: [{ brand: "Google Chrome", version: "141" }, { brand: "Chromium", version: "141" }],
      mobile: false,
      platform: "Windows",
      getHighEntropyValues: async () => ({}),
    }),
  });
  window.LanguageModel = {
    availability: async () => "available",
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
})();`;

/**
 * Chrome as above, whose built-in AI makes `NOTES`, and whose speech recognition hears
 * one of `LINES` each time AI notes start.
 */
const LINES = [
  "Let's launch the beta on March 3rd.",
  "And drop the old billing page.",
];
const NOTES = {
  summary: "The team settled the beta launch date.",
  actionItems: [],
  decisions: ["Launch the beta on March 3rd"],
};
const CHROME_MAKING_NOTES = `(() => {
  Object.defineProperty(navigator, "userAgentData", {
    get: () => ({
      brands: [{ brand: "Google Chrome", version: "141" }, { brand: "Chromium", version: "141" }],
      mobile: false,
      platform: "Windows",
      getHighEntropyValues: async () => ({}),
    }),
  });
  window.LanguageModel = {
    availability: async () => "available",
    create: async () => ({
      prompt: async () => ${JSON.stringify(JSON.stringify(NOTES))},
      destroy() {},
    }),
  };
  const lines = ${JSON.stringify(LINES)};
  let next = 0;
  class Recognition {
    static async available() { return "available"; }
    static async install() { return true; }
    start() {
      this.timer = setTimeout(() => {
        const line = lines[next];
        if (line !== undefined && this.onresult) {
          next += 1;
          const result = Object.assign([{ transcript: line }], { isFinal: true });
          this.onresult({ resultIndex: 0, results: [result] });
        }
        setTimeout(() => this.onend && this.onend(), 200);
      }, 1500);
    }
    stop() { clearTimeout(this.timer); setTimeout(() => this.onend && this.onend(), 50); }
    abort() { clearTimeout(this.timer); setTimeout(() => this.onend && this.onend(), 50); }
  }
  window.SpeechRecognition = Recognition;
})();`;

/**
 * Settings → AI notes as an earlier version of FaceOn saved them in this browser: saved
 * once, before the first page, not again as pages load.
 */
const saved = (settings: object) =>
  `if (!sessionStorage.getItem("e2e.saved")) {
    sessionStorage.setItem("e2e.saved", "1");
    localStorage.setItem("faceon.aiNotes", ${JSON.stringify(JSON.stringify(settings))});
  }`;

const FREE =
  "Free: notes are made on this computer. Only people using Chrome are transcribed.";
const NEEDS_KEY = "Add a key to use AI notes in this browser.";
const TRANSCRIPT_ONLY =
  "Transcript only: notes are made only if you choose. Only people using Chrome are transcribed.";
const writes = (provider: string) =>
  `${provider} will write the notes. Only people using Chrome are transcribed.`;
const KEY = "sk-e2e-not-a-real-key";

test.describe("AI notes in this browser", () => {
  test("Settings → AI notes says in one sentence what happens here: free in Chrome, a key's provider, or add a key", async ({
    people,
  }) => {
    const host = await people.signedIn({ aiNotes: true });
    await host.context.addInitScript({ content: NO_BUILT_IN_AI });
    await standInForProviders(host.context);
    await host.page.goto("/settings/ai-notes");

    await expect(host.page.getByText(NEEDS_KEY)).toBeVisible();
    // Allowing AI notes is the account's, so it's the same in every browser: never
    // turned off or held back here.
    const allow = host.page.getByRole("switch", {
      name: /AI notes in meetings you host/,
    });
    await expect(allow).toBeChecked();
    await expect(allow).toBeEnabled();
    // No choice of how: just the key, with its model tucked away.
    await expect(host.page.getByRole("radio")).toHaveCount(0);
    const model = host.page.getByRole("combobox", { name: "Model" });
    await expect(model).toBeHidden();
    await host.page.getByRole("button", { name: "More options" }).click();
    await expect(model).toBeVisible();

    // A key: its provider writes the notes. Removing it goes back.
    const key = host.page.getByLabel("API key", { exact: true });
    await key.fill(KEY);
    await expect(host.page.getByText(writes("OpenAI"))).toBeVisible();
    await expect(host.page.getByText(NEEDS_KEY)).toHaveCount(0);
    await key.fill("");
    await expect(host.page.getByText(NEEDS_KEY)).toBeVisible();

    // In Chrome, whose AI runs here, no key is free.
    const chrome = await people.signedIn({ aiNotes: true });
    await chrome.context.addInitScript({ content: CHROME_WITH_AI });
    await standInForProviders(chrome.context);
    await chrome.page.goto("/settings/ai-notes");
    await expect(chrome.page.getByText(FREE)).toBeVisible();
    await chrome.page.getByLabel("API key", { exact: true }).fill(KEY);
    await expect(chrome.page.getByText(writes("OpenAI"))).toBeVisible();
    expectNoErrors(host, chrome);
  });

  test("choices saved before carry over: On this computer stays free, and a chosen key is kept", async ({
    people,
  }) => {
    // On this computer, with a key kept beside it: the key goes, and that's said once.
    const free = await people.signedIn({ aiNotes: true });
    await free.context.addInitScript({
      content: `${CHROME_WITH_AI}${saved({ engine: "onDevice", keys: { openai: KEY } })}`,
    });
    await free.page.goto("/settings/ai-notes");
    await expect(free.page.getByText(FREE)).toBeVisible();
    const key = free.page.getByLabel("API key", { exact: true });
    await expect(key).toHaveValue("");
    const note = free.page
      .getByRole("note")
      .filter({ hasText: /Your AI key was removed from this browser/ });
    await expect(note).toBeVisible();
    await note.getByRole("button", { name: "Got it" }).click();
    await expect(note).toHaveCount(0);
    await expect(key).toBeFocused();
    expect(
      await free.page.evaluate(() => localStorage.getItem("faceon.aiNotes")),
    ).not.toContain(KEY);
    await free.page.reload();
    await expect(free.page.getByText(FREE)).toBeVisible();
    await expect(note).toHaveCount(0);

    // Their own key: still used.
    const keyed = await people.signedIn({ aiNotes: true });
    await keyed.context.addInitScript({
      content: `${CHROME_WITH_AI}${saved({
        engine: "ownKey",
        provider: "anthropic",
        keys: { anthropic: KEY },
      })}`,
    });
    await standInForProviders(keyed.context);
    await keyed.page.goto("/settings/ai-notes");
    await expect(keyed.page.getByText(writes("Anthropic"))).toBeVisible();
    await expect(keyed.page.getByLabel("API key", { exact: true })).toHaveValue(
      KEY,
    );
    expectNoErrors(free, keyed);
  });

  test("the meeting's Start AI notes is disabled with why, by keyboard too, until a key is added", async ({
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
      await host.context.addInitScript({ content: NO_BUILT_IN_AI });
      await standInForProviders(host.context);
      await openMeeting(host.page, meeting);
      await joinFromPreJoin(host.page);
      await host.page.getByRole("button", { name: /^More/ }).click();
      await host.page.getByRole("menuitem", { name: "AI notes" }).click();

      const start = host.page.getByRole("button", { name: "Start AI notes" });
      await expect(start).toBeDisabled();
      await expect(start).toHaveAccessibleDescription(NEEDS_KEY);
      const addKey = host.page.getByRole("button", {
        name: "Add a key",
        exact: true,
      });
      await expect(addKey).toBeVisible();

      // From the link, Tab reaches the button, and its tooltip says why.
      await addKey.focus();
      await host.page.keyboard.press("Tab");
      await expect(start).toBeFocused();
      await expect(host.page.getByRole("tooltip")).toHaveText(NEEDS_KEY);
      // Pressing it starts nothing.
      await host.page.keyboard.press("Enter");
      await expect(
        host.page.getByRole("button", { name: "AI notes on" }),
      ).toHaveCount(0);

      // The link opens Settings → AI notes, where a key makes notes possible here. (By
      // keyboard: leaving the button closes the tooltip, which sits over the link.)
      await addKey.focus();
      await expect(host.page.getByRole("tooltip")).toHaveCount(0);
      await addKey.press("Enter");
      const settings = host.page.getByRole("dialog");
      await expect(settings.getByText(NEEDS_KEY)).toBeVisible();
      // Straight to the key, which is what's missing.
      const key = settings.getByLabel("API key", { exact: true });
      await expect(key).toBeFocused();
      await key.fill(KEY);
      await expect(settings.getByText(writes("OpenAI"))).toBeVisible();
      await host.page.keyboard.press("Escape");
      await expect(start).toBeEnabled();
      await expect(addKey).toHaveCount(0);
      expectNoErrors(host);
    } finally {
      await database().query(`delete from host_allowlist where email = $1`, [
        host.user.email.toLowerCase(),
      ]);
    }
  });

  test("Settings → AI notes tests a key as it's entered, and a link to #key goes straight to it", async ({
    people,
  }) => {
    const host = await people.signedIn({ aiNotes: true });
    await host.context.addInitScript({ content: NO_BUILT_IN_AI });
    const works = "sk-e2e-works";
    await standInForProviders(host.context, (key) => key === works);
    await host.page.goto("/settings/ai-notes#key");
    const key = host.page.getByLabel("API key", { exact: true });
    await expect(key).toBeFocused();

    // Refused as it's typed, with the provider's reason, before anyone selects Test key.
    await key.fill("sk-e2e-wrong");
    const result = host.page
      .getByRole("status")
      .filter({ hasText: "OpenAI didn't accept your key." });
    await expect(result).toContainText(REFUSED);
    await key.fill(works);
    await expect(host.page.getByText("Key works")).toBeVisible();
    await expect(result).toHaveCount(0);
    expectNoErrors(host);
  });

  test("a key its provider refuses is said as AI notes start, and in Chrome the notes are still made on this computer", async ({
    people,
  }) => {
    needsStream();
    test.setTimeout(150_000);
    const host = await people.signedIn({ name: "Notes Host", aiNotes: true });
    // Only full meetings offer AI notes.
    await database().query(
      `insert into host_allowlist (email, note) values ($1, 'e2e') on conflict do nothing`,
      [host.user.email.toLowerCase()],
    );
    try {
      const meeting = await createMeeting(host.user.id);
      await host.context.addInitScript({
        content: `${CHROME_MAKING_NOTES}${saved({ provider: "openai", keys: { openai: KEY } })}`,
      });
      await standInForProviders(host.context, () => false);
      const toOpenAi: string[] = [];
      host.page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes("api.openai.com")
        ) {
          toOpenAi.push(request.url());
        }
      });
      await openMeeting(host.page, meeting);
      await joinFromPreJoin(host.page);
      await host.page.getByRole("button", { name: /^More/ }).click();
      await host.page.getByRole("menuitem", { name: "AI notes" }).click();
      await host.page.getByRole("button", { name: "Start AI notes" }).click();

      // Said at once, in a toast and in the panel, while the transcript keeps building.
      const refused = "OpenAI didn't accept your key.";
      await expect(
        host.page.locator("[data-sonner-toast]").filter({ hasText: refused }),
      ).toContainText("AI notes are still on, and the transcript is kept.");
      const note = host.page.getByRole("note").filter({ hasText: refused });
      await expect(note).toBeVisible();
      await expect(host.page.getByText(LINES[0]!)).toBeVisible({
        timeout: 30_000,
      });

      // Fix the key opens Settings at the key.
      await note.getByRole("button", { name: "Fix the key" }).click();
      await expect(
        host.page.getByRole("dialog").getByLabel("API key", { exact: true }),
      ).toBeFocused();
      await host.page.keyboard.press("Escape");

      // Left as it is, the key can't make the notes; in Chrome, this computer can, this
      // once, and the key stays.
      await host.page.getByRole("button", { name: "Stop AI notes" }).click();
      await expect(
        host.page.getByRole("alert").filter({ hasText: refused }),
      ).toContainText(REFUSED);
      await host.page
        .getByRole("button", { name: "Make them on this computer instead" })
        .click();
      await expect(
        host.page.getByText(/^Made on this computer at/),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        host.page.getByText("Launch the beta on March 3rd", { exact: true }),
      ).toBeVisible();
      expect(
        await host.page.evaluate(() => localStorage.getItem("faceon.aiNotes")),
      ).toContain(KEY);

      // Started again, the key is still said to be refused; stopped, the notes are made
      // here again, with what's been said since, without trying the key again.
      await host.page
        .getByRole("button", { name: "Start AI notes again" })
        .click();
      await expect(note).toBeVisible();
      await expect(host.page.getByText(LINES[1]!)).toBeVisible({
        timeout: 30_000,
      });
      await host.page.getByRole("button", { name: "Stop AI notes" }).click();
      await expect(
        host.page.getByText(/^Made on this computer at/),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        host.page.getByText(/^Made before the rest of the transcript/),
      ).toHaveCount(0);
      await expect(
        host.page.getByRole("alert").filter({ hasText: refused }),
      ).toHaveCount(0);
      // OpenAI was asked twice: to test the key as AI notes first started, and for the
      // notes it refused.
      expect(toOpenAi).toHaveLength(2);
      expectNoErrors(host);
    } finally {
      await database().query(`delete from host_allowlist where email = $1`, [
        host.user.email.toLowerCase(),
      ]);
    }
  });

  test("More options keeps words to know and a transcript only, which starts in any browser", async ({
    people,
  }) => {
    const host = await people.signedIn({ aiNotes: true });
    await host.context.addInitScript({ content: NO_BUILT_IN_AI });
    await standInForProviders(host.context);
    await host.page.goto("/settings/ai-notes");
    await expect(host.page.getByText(NEEDS_KEY)).toBeVisible();

    // Out of sight until asked for.
    const words = host.page.getByLabel("Words to know");
    const only = host.page.getByRole("switch", { name: "Transcript only" });
    await expect(words).toBeHidden();
    await expect(only).toBeHidden();
    await host.page.getByRole("button", { name: "More options" }).click();
    await words.fill("Priya Raman, SSO");
    await host.page.locator("label", { has: only }).click();
    await expect(only).toBeChecked();
    // Nothing's needed to make a transcript, so this browser can start one.
    await expect(host.page.getByText(TRANSCRIPT_ONLY)).toBeVisible();
    await expect(host.page.getByText(NEEDS_KEY)).toHaveCount(0);

    // Kept, and in sight, next time.
    await host.page.reload();
    await expect(host.page.getByText(TRANSCRIPT_ONLY)).toBeVisible();
    await expect(words).toHaveValue("Priya Raman, SSO");
    await expect(only).toBeChecked();
    expectNoErrors(host);
  });

  test("a transcript only is said to everyone, sends the transcript nowhere, and makes notes only when asked, with the words to know", async ({
    people,
  }) => {
    needsStream();
    test.setTimeout(180_000);
    const host = await people.signedIn({ name: "Notes Host", aiNotes: true });
    // Only full meetings offer AI notes.
    await database().query(
      `insert into host_allowlist (email, note) values ($1, 'e2e') on conflict do nothing`,
      [host.user.email.toLowerCase()],
    );
    try {
      const meeting = await createMeeting(host.user.id);
      await host.context.addInitScript({
        content: `${CHROME_MAKING_NOTES}${saved({
          transcriptOnly: true,
          words: "Priya Raman\nSSO",
          provider: "openai",
          keys: { openai: KEY },
        })}`,
      });
      // OpenAI, for the notes asked for in the end; what it's sent is noted.
      const toOpenAi: string[] = [];
      await host.context.route(
        "https://api.openai.com/v1/chat/completions",
        async (route) => {
          const cors = { "access-control-allow-origin": "*" };
          if (route.request().method() === "OPTIONS") {
            await route.fulfill({
              status: 204,
              headers: {
                ...cors,
                "access-control-allow-headers": "*",
                "access-control-allow-methods": "POST",
              },
            });
            return;
          }
          toOpenAi.push(route.request().postData() ?? "");
          await route.fulfill({
            status: 200,
            headers: cors,
            json: {
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: JSON.stringify(NOTES),
                  },
                },
              ],
            },
          });
        },
      );
      const guest = await people.guest();
      await guest.context.addInitScript({ content: CHROME_WITH_AI });
      await openMeeting(host.page, meeting);
      await joinFromPreJoin(host.page);
      await openMeeting(guest.page, meeting);
      await joinFromPreJoin(guest.page, "Riley Guest");

      // The panel says what Start will do here, and everyone's told as it does.
      await host.page.getByRole("button", { name: /^More/ }).click();
      await host.page.getByRole("menuitem", { name: "AI notes" }).click();
      await expect(host.page.getByText(TRANSCRIPT_ONLY)).toBeVisible();
      await host.page.getByRole("button", { name: "Start AI notes" }).click();
      await expect(
        guest.page.getByText(
          "Notes Host turned on AI notes for a transcript only. You can choose not to be transcribed.",
        ),
      ).toBeVisible();
      await expect(
        guest.page
          .getByText(
            "Notes Host keeps a transcript only, and makes notes only if they choose. Only people using Chrome are transcribed.",
          )
          .first(),
      ).toBeVisible();
      const late = await people.guest();
      await openMeeting(late.page, meeting);
      await expect(
        late.page.getByText(
          "AI notes are on in this meeting, for a transcript only. You can choose not to be transcribed.",
        ),
      ).toBeVisible();
      await expect(host.page.getByText(LINES[0]!)).toBeVisible({
        timeout: 30_000,
      });

      // Stopped, it's the transcript, to copy or keep, and no notes.
      await host.page.getByRole("button", { name: "Stop AI notes" }).click();
      await expect(
        host.page.getByText(
          "Transcript only: notes are made only if you choose.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        host.page.getByRole("button", { name: "Download .md" }),
      ).toBeVisible();
      await expect(host.page.getByText(/^Made by/)).toHaveCount(0);

      // Started again as a transcript only, it stays one, though Settings changes
      // before it stops: no notes nobody was told about.
      await host.page
        .getByRole("button", { name: "Start AI notes again" })
        .click();
      await expect(host.page.getByText(LINES[1]!)).toBeVisible({
        timeout: 30_000,
      });
      await host.page.getByRole("button", { name: /^More/ }).click();
      await host.page.getByRole("menuitem", { name: "Settings" }).click();
      const settings = host.page.getByRole("dialog");
      await settings.getByRole("tab", { name: "AI notes" }).click();
      const only = settings.getByRole("switch", { name: "Transcript only" });
      await settings
        .locator("label", {
          has: host.page.getByRole("switch", { name: "Transcript only" }),
        })
        .click();
      await expect(only).not.toBeChecked();
      await host.page.keyboard.press("Escape");
      await host.page.getByRole("button", { name: "Stop AI notes" }).click();
      await host.page.getByRole("button", { name: "Make notes" }).click();
      await expect(host.page.getByText(/^Made by OpenAI at/)).toBeVisible({
        timeout: 30_000,
      });
      // The transcript went to OpenAI once, for these notes, with the words to know.
      // (Settings tests a key it shows, with a word or two and nothing of the meeting.)
      const withTranscript = toOpenAi.filter((body) =>
        body.includes("March 3rd"),
      );
      expect(withTranscript).toHaveLength(1);
      expect(withTranscript[0]).toContain("Priya Raman, SSO.");
      expectNoErrors(host, guest, late);
    } finally {
      await database().query(`delete from host_allowlist where email = $1`, [
        host.user.email.toLowerCase(),
      ]);
    }
  });
});
