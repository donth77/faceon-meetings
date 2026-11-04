import type { Page } from "@playwright/test";

import { createScheduledMeeting } from "./support/db";
import { expect, expectNoErrors, test } from "./support/fixtures";

/**
 * Stands in for the system's notifications, as if they were allowed: the page's own and
 * the service worker's are recorded by title instead of shown.
 */
async function recordNotifications(page: Page) {
  await page.addInitScript(() => {
    const shown: string[] = [];
    class Recorded {
      static permission = "granted";
      static requestPermission = () => Promise.resolve("granted");
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      constructor(title: string) {
        shown.push(title);
      }
      close() {}
    }
    Object.assign(window, {
      Notification: Recorded,
      shownNotifications: shown,
    });
    ServiceWorkerRegistration.prototype.showNotification = (title: string) => {
      shown.push(title);
      return Promise.resolve();
    };
  });
}

const shownNotifications = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { shownNotifications: string[] })
        .shownNotifications,
  );

/** The desktop app's bridge, as its preload adds it, with every call doing nothing. */
async function insideDesktopApp(page: Page) {
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
}

test.describe("Meeting reminders", () => {
  test("in a browser: a pop-up and a system notification, a few minutes before", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    await createScheduledMeeting(host.user.id, {
      title: "Budget review",
      startsInMinutes: 3,
    });
    await recordNotifications(page);
    await page.goto("/home");
    // The reminder's time (5 minutes before, the default) has passed: it shows at once.
    await expect(
      page.getByText(/^Budget review starts in \d minutes?$/),
    ).toBeVisible();
    await expect
      .poll(() => shownNotifications(page))
      .toEqual([
        expect.stringMatching(/^Budget review starts in \d minutes?$/),
      ]);
    expectNoErrors(host);
  });

  test("in the desktop app: only the pop-up, since the app shows the system notification", async ({
    people,
  }) => {
    const host = await people.signedIn();
    const { page } = host;
    await createScheduledMeeting(host.user.id, {
      title: "Budget review",
      startsInMinutes: 3,
    });
    await recordNotifications(page);
    await insideDesktopApp(page);
    await page.goto("/home");
    await expect(
      page.getByText(/^Budget review starts in \d minutes?$/),
    ).toBeVisible();
    // A system notification would have been asked for by now, alongside the pop-up.
    await page.waitForTimeout(1000);
    expect(await shownNotifications(page)).toEqual([]);
    expectNoErrors(host);
  });
});
