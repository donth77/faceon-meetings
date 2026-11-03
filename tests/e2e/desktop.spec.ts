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

  test("connecting Google Calendar from the app: the browser's page", async ({
    people,
  }) => {
    // Signed out in the browser: sign in first, then back here.
    const visitor = await people.guest();
    await visitor.page.goto("/desktop/calendar?for=someone");
    await expect(
      visitor.page.getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent("/desktop/calendar?for=someone")}`,
    );

    // Signed in to another account than the app's: it says so, and never connects.
    const host = await people.signedIn();
    await host.page.goto("/desktop/calendar?for=someone-else");
    await expect(
      host.page.getByRole("button", { name: "Sign out and switch" }),
    ).toBeVisible();

    // The app asks where the connection stands while the browser connects.
    const reply = await host.page.request.get(
      "/api/integrations/google-calendar",
    );
    expect(reply.ok()).toBe(true);
    expect(
      ["unavailable", "disconnected"].includes(
        ((await reply.json()) as { connection: { status: string } }).connection
          .status,
      ),
    ).toBe(true);
    expectNoErrors(host);
  });

  test.describe("download links, by device", () => {
    const RELEASE = {
      available: true,
      version: "1.2.3",
      publishedAt: "2026-11-01T12:00:00Z",
      releases: "https://github.com/acme/faceon-releases/releases",
      windows: {
        url: "https://github.com/acme/faceon-releases/releases/download/v1.2.3/FaceOn-Setup.exe",
        size: 71_303_168,
        signed: false,
      },
      mac: {
        url: "https://github.com/acme/faceon-releases/releases/download/v1.2.3/FaceOn.dmg",
        size: 98_566_144,
        signed: false,
      },
    };
    const AGENTS = {
      windows:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      linux:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      chromeOs:
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      phone:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    } as const;

    for (const [device, userAgent] of Object.entries(AGENTS)) {
      test(`the landing page on ${device}`, async ({ people }) => {
        const visitor = await people.guest({
          userAgent,
          viewport:
            device === "phone"
              ? { width: 375, height: 812 }
              : { width: 1440, height: 900 },
        });
        await visitor.page.route("**/api/desktop/release", (route) =>
          route.fulfill({ json: RELEASE }),
        );
        await visitor.page.goto("/");
        await visitor.page.waitForLoadState("networkidle");
        const downloads = visitor.page.getByRole("link", {
          name: /^Download for/,
        });
        if (device === "windows" || device === "mac") {
          // Only this computer's: the other's is on /download.
          await expect(downloads).toHaveCount(1);
          await expect(downloads).toHaveText(
            device === "windows" ? "Download for Windows" : "Download for Mac",
          );
          await expect(downloads).toHaveAttribute("href", RELEASE[device].url);
        } else {
          await expect(downloads).toHaveCount(0);
        }
        expectNoErrors(visitor);
      });
    }

    test("a Mac before its build is out: no download", async ({ people }) => {
      const visitor = await people.guest({ userAgent: AGENTS.mac });
      await visitor.page.route("**/api/desktop/release", (route) =>
        route.fulfill({ json: { ...RELEASE, mac: null } }),
      );
      await visitor.page.goto("/");
      await visitor.page.waitForLoadState("networkidle");
      await expect(
        visitor.page.getByRole("link", { name: /^Download for/ }),
      ).toHaveCount(0);
    });

    test("Windows: Settings offers the download, with its version and size", async ({
      people,
    }) => {
      const host = await people.signedIn({ userAgent: AGENTS.windows });
      await host.page.route("**/api/desktop/release", (route) =>
        route.fulfill({ json: RELEASE }),
      );
      await host.page.goto("/settings");
      await expect(
        host.page.getByRole("link", { name: "Download for Windows" }),
      ).toHaveAttribute("href", RELEASE.windows.url);
      await expect(host.page.getByText("Version 1.2.3 · 68 MB")).toBeVisible();
      await expect(
        host.page.getByRole("link", { name: "Download for Mac" }),
      ).toHaveCount(0);
      expectNoErrors(host);
    });

    test("Linux: Settings has no desktop download", async ({ people }) => {
      const host = await people.signedIn({ userAgent: AGENTS.linux });
      await host.page.route("**/api/desktop/release", (route) =>
        route.fulfill({ json: RELEASE }),
      );
      await host.page.goto("/settings");
      await host.page.waitForLoadState("networkidle");
      await expect(
        host.page.getByRole("link", { name: /^Download for/ }),
      ).toHaveCount(0);
    });
  });
});
