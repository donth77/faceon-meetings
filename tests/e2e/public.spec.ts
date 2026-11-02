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
