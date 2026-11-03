import { createHash, randomBytes } from "node:crypto";

import { expect, expectNoErrors, test } from "./support/fixtures";

test.describe("the desktop app", () => {
  test("signing in through the browser hands over once, service worker and all", async ({
    people,
  }) => {
    // The browser: someone signed in there makes the hand-off, as /desktop/sign-in does.
    const browser = await people.signedIn();
    await browser.page.goto("/home");
    const verifier = randomBytes(32).toString("base64url");
    const handoff = await browser.page.request.post(
      "/api/auth/desktop/handoff",
      {
        data: {
          challenge: createHash("sha256").update(verifier).digest("base64url"),
        },
        headers: { origin: new URL(browser.page.url()).origin },
      },
    );
    expect(handoff.ok()).toBe(true);
    const { token } = (await handoff.json()) as { token: string };

    // The app's window: signed out, with the site's service worker in control, as it is
    // once the app has shown a page or two.
    const app = await people.guest();
    await app.page.goto("/desktop/welcome");
    await app.page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await app.page.reload();
    await expect
      .poll(() =>
        app.page.evaluate(() => navigator.serviceWorker.controller !== null),
      )
      .toBe(true);

    // The exchange, as the app makes it. The worker's early request (navigation
    // preload) and the browser's own must not both spend the token: one of them would
    // land on "That sign-in didn't finish" with the window signed in after all.
    await app.page.setExtraHTTPHeaders({
      "X-FaceOn-Handoff": `${token}.${verifier}`,
    });
    await app.page.goto("/api/auth/desktop/session");
    await expect(app.page).toHaveURL(/\/home$/);
    // Asked again (a retry): still Home, never a false "didn't finish".
    await app.page.goto("/api/auth/desktop/session");
    await expect(app.page).toHaveURL(/\/home$/);
    expectNoErrors(app);
  });
});
