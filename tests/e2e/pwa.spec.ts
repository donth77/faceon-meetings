import { expect, expectNoErrors, test } from "./support/fixtures";

test.describe("installing as an app", () => {
  test("the manifest describes an installable app", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      name?: string;
      start_url?: string;
      display?: string;
      icons?: Array<{ sizes?: string; purpose?: string }>;
    };
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe("/home");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
    expect(manifest.icons?.some((icon) => icon.purpose === "maskable")).toBe(
      true,
    );
  });

  test("the service worker takes over, and offline shows the offline page", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page, context } = visitor;
    await page.goto("/");
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return registration.active?.state;
        }),
      )
      .toBe("activated");
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() => navigator.serviceWorker.controller !== null),
      )
      .toBe(true);

    await context.setOffline(true);
    await page.goto("/help").catch(() => {});
    await expect(page.getByText("You’re offline")).toBeVisible();
    // The meeting API is never answered from storage.
    const api = await page.evaluate(() =>
      fetch("/api/meetings/1234567890").then(
        () => "answered",
        () => "failed",
      ),
    );
    expect(api).toBe("failed");
    await context.setOffline(false);
    expectNoErrors(visitor);
  });
});
