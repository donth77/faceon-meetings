import { createMeeting, database } from "./support/db";
import {
  expect,
  expectNoErrors,
  needsStream,
  test,
  type Person,
} from "./support/fixtures";
import { joinFromPreJoin, openMeeting } from "./support/meeting";

/** What each person says, one line each time their speech recognition listens. */
const HOST_LINES = [
  "Thanks for joining. Today we settle the beta launch date.",
  "Let's launch the beta on March 3rd.",
];
const GUEST_LINES = [
  "Agreed. I will send the release checklist by Friday.",
  "We should also drop the old billing page.",
];
/** The host's own Anthropic key, as Settings → AI notes keeps it. */
const KEY = "sk-ant-e2e-not-a-real-key";
/** Anthropic's notes, as the model answers them. */
const NOTES = {
  summary:
    "The team settled the beta launch date and agreed to drop the old billing page.",
  actionItems: [
    { task: "Send the release checklist", owner: "Riley Guest", due: "Friday" },
  ],
  decisions: ["Launch the beta on March 3rd", "Drop the old billing page"],
};

/**
 * Chrome on a computer as far as FaceOn can tell, with speech recognition standing in for
 * Chrome's on-device kind, which a test browser doesn't have: it "hears" `lines`, one each
 * time it listens, and notes how it was asked to listen. With `settings`, Settings → AI
 * notes as the host left it.
 */
function browserLike(lines: string[], settings?: object): string {
  return `(() => {
    const lines = ${JSON.stringify(lines)};
    Object.defineProperty(navigator, "userAgentData", {
      get: () => ({
        brands: [{ brand: "Google Chrome", version: "141" }, { brand: "Chromium", version: "141" }],
        mobile: false,
        platform: "Windows",
        getHighEntropyValues: async () => ({}),
      }),
    });
    let next = 0;
    class Recognition {
      constructor() {
        this.lang = "";
        this.continuous = false;
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.processLocally = false;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
      }
      static async available() { return "available"; }
      static async install() { return true; }
      start(track) {
        window.__listened = { lang: this.lang, onDevice: this.processLocally, track: track ? track.kind : null };
        this.timer = setTimeout(() => {
          const line = lines[next];
          if (line !== undefined) {
            next += 1;
            const result = Object.assign([{ transcript: line }], { isFinal: true });
            if (this.onresult) this.onresult({ resultIndex: 0, results: [result] });
          }
          setTimeout(() => { if (this.onend) this.onend(); }, 200);
        }, 1500);
      }
      stop() { clearTimeout(this.timer); setTimeout(() => { if (this.onend) this.onend(); }, 50); }
      abort() { clearTimeout(this.timer); setTimeout(() => { if (this.onend) this.onend(); }, 50); }
    }
    window.SpeechRecognition = Recognition;
    ${settings ? `localStorage.setItem("faceon.aiNotes", ${JSON.stringify(JSON.stringify(settings))});` : ""}
  })();`;
}

/** Whether any request so far, other than to `allowed`, carried `secret`. */
function watchFor(person: Person, secret: string) {
  const leaks: string[] = [];
  person.page.on("request", (request) => {
    const url = new URL(request.url());
    const sent = `${request.url()} ${JSON.stringify(request.headers())} ${request.postData() ?? ""}`;
    if (sent.includes(secret)) leaks.push(`${request.method()} ${url.host}`);
  });
  return leaks;
}

test.describe("AI notes", () => {
  test("everyone's words reach the host's transcript, and notes made with the host's own key are saved, shared and deleted", async ({
    people,
    baseURL,
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
      const guest = await people.signedIn({ name: "Riley Guest" });
      const meeting = await createMeeting(host.user.id);
      await host.context.addInitScript({
        content: browserLike(HOST_LINES, {
          engine: "ownKey",
          provider: "anthropic",
          keys: { anthropic: KEY },
        }),
      });
      await guest.context.addInitScript({ content: browserLike(GUEST_LINES) });

      // The host's key goes to Anthropic and nowhere else; the transcript reaches
      // FaceOn's server only when the host saves it.
      const keySentTo = watchFor(host, KEY);
      const transcriptSentTo = watchFor(host, "March 3rd");
      const asked: Array<Record<string, string | undefined>> = [];
      await host.context.route(
        "https://api.anthropic.com/v1/messages",
        async (route) => {
          const request = route.request();
          const headers = request.headers();
          asked.push({
            key: headers["x-api-key"],
            version: headers["anthropic-version"],
            fromBrowser: headers["anthropic-dangerous-direct-browser-access"],
            model: JSON.parse(request.postData() ?? "{}").model,
          });
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({
              id: "msg_e2e",
              type: "message",
              role: "assistant",
              model: "claude-opus-5-5",
              content: [{ type: "text", text: JSON.stringify(NOTES) }],
              stop_reason: "end_turn",
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
          });
        },
      );

      await openMeeting(host.page, meeting);
      await joinFromPreJoin(host.page);
      await host.page.getByRole("button", { name: /^More/ }).click();
      await host.page.getByRole("menuitem", { name: "AI notes" }).click();
      await host.page.getByRole("button", { name: "Start AI notes" }).click();

      // Everyone is told as they come in, and can choose not to be transcribed.
      await openMeeting(guest.page, meeting);
      await joinFromPreJoin(guest.page);
      await expect(
        guest.page.getByText(/^Notes Host turned on AI notes/),
      ).toBeVisible();
      await expect(
        guest.page.getByRole("button", { name: "Don't transcribe me" }),
      ).toBeVisible();

      // Each person's own device transcribes them; the lines gather in the host's tab.
      for (const line of [...HOST_LINES, ...GUEST_LINES]) {
        await expect(host.page.getByText(line)).toBeVisible({
          timeout: 30_000,
        });
      }
      for (const person of [host, guest]) {
        expect(
          await person.page.evaluate(
            () => (window as unknown as { __listened: unknown }).__listened,
          ),
        ).toEqual({ lang: "en-US", onDevice: true, track: "audio" });
      }

      // Stopping AI notes makes the notes, with the host's key.
      await host.page.getByRole("button", { name: "Stop AI notes" }).click();
      await expect(
        host.page.getByRole("heading", { name: "Summary" }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        host.page.getByText("Launch the beta on March 3rd", { exact: true }),
      ).toBeVisible();
      expect(asked).toEqual([
        {
          key: KEY,
          version: "2023-06-01",
          fromBrowser: "true",
          model: "claude-opus-5-5",
        },
      ]);
      expect(keySentTo).toEqual(["POST api.anthropic.com"]);
      expect(
        transcriptSentTo.filter(
          (request) => !request.endsWith("api.anthropic.com"),
        ),
      ).toEqual([]);

      // Saved with the meeting, then shared with its participants.
      await host.page.getByRole("button", { name: "Save to meeting" }).click();
      await expect(
        host.page.getByText(/^Saved with the meeting/),
      ).toBeVisible();
      const saved = async () =>
        (
          await database().query<{
            session_id: string;
            engine: string;
            provider: string | null;
            shared: boolean;
            transcript: string | null;
          }>(
            `select n.session_id, n.engine, n.provider, n.shared, n.transcript
             from meeting_notes n join meeting_session s on s.id = n.session_id
             where s.meeting_id = $1`,
            [meeting.id],
          )
        ).rows;
      await expect
        .poll(async () =>
          (await saved()).map(({ engine, provider, shared }) => ({
            engine,
            provider,
            shared,
          })),
        )
        .toEqual([{ engine: "ownKey", provider: "anthropic", shared: false }]);
      expect((await saved())[0]?.transcript).toContain("March 3rd");
      await host.page
        .getByRole("button", { name: "Share with participants" })
        .click();
      await expect.poll(async () => (await saved())[0]?.shared).toBe(true);

      // The guest, who has an account, reads them in Previous.
      const sessionId = (await saved())[0]?.session_id;
      await guest.page.goto(`${baseURL}/previous/${sessionId}/notes`);
      await expect(
        guest.page.getByText("Launch the beta on March 3rd", { exact: true }),
      ).toBeVisible();

      // The host deletes them for everyone.
      await host.page.goto(`${baseURL}/previous/${sessionId}/notes`);
      await host.page.getByRole("button", { name: "Delete notes" }).click();
      await host.page
        .getByRole("button", { name: /^Delete/ })
        .last()
        .click();
      await expect(host.page.getByText("Notes deleted")).toBeVisible();
      await expect.poll(async () => (await saved()).length).toBe(0);

      expectNoErrors(host, guest);
    } finally {
      await database().query(`delete from host_allowlist where email = $1`, [
        host.user.email.toLowerCase(),
      ]);
    }
  });
});
