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
const writes = (provider: string) =>
  `${provider} will write the notes. Only people using Chrome are transcribed.`;
const KEY = "sk-e2e-not-a-real-key";

test.describe("AI notes in this browser", () => {
  test("Settings → AI notes says in one sentence what happens here: free in Chrome, a key's provider, or add a key", async ({
    people,
  }) => {
    const host = await people.signedIn({ aiNotes: true });
    await host.context.addInitScript({ content: NO_BUILT_IN_AI });
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
      await settings.getByLabel("API key", { exact: true }).fill(KEY);
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
});
