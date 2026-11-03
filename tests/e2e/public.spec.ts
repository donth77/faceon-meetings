import { expect, expectNoErrors, test } from "./support/fixtures";

test.describe("signed-out pages", () => {
  test("the landing page puts joining first, with the footer's links", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /Video meetings/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Enter a meeting ID or link")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Start a meeting/ }),
    ).toHaveAttribute("href", "/sign-up");
    await expect(
      page.getByRole("link", { name: "Create a free account" }),
    ).toHaveAttribute("href", "/sign-up");
    const footer = page.getByRole("contentinfo");
    for (const [name, href] of [
      ["Help", "/help"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Credits", "/credits"],
    ] as const) {
      await expect(footer.getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
    expectNoErrors(visitor);
  });

  test("the landing page has six highlights, one of them FaceOn beyond the browser", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const highlights = page
      .getByRole("region", { name: "Everything you expect from a meeting app" })
      .getByRole("listitem");
    await expect(highlights).toHaveCount(6);
    for (const title of [
      "Any device",
      "Screen sharing with sound",
      "Waiting room and passcodes",
      "Backgrounds and effects",
      "Free and open source",
    ]) {
      await expect(
        highlights.getByText(title, { exact: true }).filter({ visible: true }),
      ).toBeVisible();
    }
    // The desktop app, the Google add-on, both, or installing the web app: whichever
    // this copy has.
    await expect(
      highlights
        .getByText(
          /^(Desktop app|In Google Calendar and Gmail|Desktop app and Google add-on|Install it as an app)$/,
        )
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByText("Six languages")).toHaveCount(0);
    expectNoErrors(visitor);
  });

  test("the desktop app's first screen fits its first window", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    // The app's first window is 1280×820; this is what's inside its frame on Windows.
    await page.setViewportSize({ width: 1264, height: 781 });
    const fits = () =>
      page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      );
    await page.goto("/desktop/welcome");
    await expect(
      page.getByRole("heading", { level: 1, name: /Welcome to/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Enter a meeting ID or link")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/sign-up");
    expect(await fits()).toBe(true);

    // Signing in, in the app (its bridge, stood in for): no Join card or footer.
    await page.addInitScript(() => {
      const none = () => () => {};
      Object.assign(window, {
        faceonDesktop: new Proxy(
          { bridge: 1, platform: "windows", version: "0.0.0" },
          {
            get: (bridge, key) => (key in bridge ? bridge[key as never] : none),
          },
        ),
      });
    });
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { level: 1, name: /Sign in/ }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    expect(await fits()).toBe(true);
    expectNoErrors(visitor);
  });

  test("signed in, the desktop app's first screen is Home", async ({
    people,
  }) => {
    const host = await people.signedIn();
    await host.page.goto("/desktop/welcome");
    await expect(host.page).toHaveURL(/\/home$/);
    expectNoErrors(host);
  });

  test("the legal pages and the credits fill in this copy's details", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    for (const [path, title] of [
      ["/privacy", "Privacy policy"],
      ["/terms", "Terms of service"],
      ["/credits", "Credits"],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      // Every {placeholder} is filled.
      await expect(page.locator("main")).not.toContainText(/\{\w+\}/);
    }
    await expect(page.getByText(/Natalia Spivak/)).toBeVisible();
    expectNoErrors(visitor);
  });

  test("sign-in and sign-up say what you agree to", async ({ people }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await page.goto("/sign-up");
    await expect(
      page.getByRole("heading", { level: 1, name: /Create your .* account/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/By creating an account, you agree/),
    ).toBeVisible();
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { level: 1, name: /Sign in to/ }),
    ).toBeVisible();
    await expect(page.getByText(/By continuing, you agree/)).toBeVisible();
    expectNoErrors(visitor);
  });

  test("phones get the same page without sideways scrolling", async ({
    people,
  }) => {
    const visitor = await people.guest({
      viewport: { width: 375, height: 812 },
    });
    const { page } = visitor;
    for (const path of ["/", "/sign-in", "/sign-up", "/help", "/privacy"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    expectNoErrors(visitor);
  });
});
