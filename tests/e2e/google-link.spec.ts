import type { Page } from "@playwright/test";

import { expect, expectNoErrors, test } from "./support/fixtures";

/*
 * Connecting a Google account whose email isn't the account's (lib/auth/linking-rules.ts).
 * The tests' server has no Google client, so Google's consent screen is stubbed at
 * Better Auth's link-social, which sends the page straight back, as Google does; the
 * go-ahead before it is the real POST /api/integrations/google-link.
 */

const SCRIPT_SCOPE = "https://www.googleapis.com/auth/script.projects";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";
const SCRIPT_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";

type LinkRequest = {
  scopes: string[];
  loginHint?: string;
  additionalParams?: Record<string, string>;
};

/** Google's consent screen: notes each request and comes straight back to `back`. */
async function stubConsent(page: Page, back: string): Promise<LinkRequest[]> {
  const requests: LinkRequest[] = [];
  await page.route("**/api/auth/link-social", async (route) => {
    requests.push(route.request().postDataJSON() as LinkRequest);
    const url = new URL(back, page.url());
    await route.fulfill({ json: { url: url.toString(), redirect: true } });
  });
  return requests;
}

/** The add-on card's own requests: nothing added yet, and adding makes the copy. */
async function stubAddon(page: Page) {
  await page.route("**/api/integrations/google-addon", async (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          json: {
            addon: {
              status: "created",
              scriptId: SCRIPT_ID,
              needsUpdate: false,
            },
          },
        })
      : route.fulfill({ json: { addon: { status: "none", granted: false } } }),
  );
}

test.describe("Connecting a Google account with a different email", () => {
  test("the add-on: confirm it, then choose the account at Google", async ({
    people,
  }) => {
    const person = await people.signedIn();
    const { page } = person;
    await stubAddon(page);
    const requests = await stubConsent(page, "/settings/calendar?addon=add");

    await page.goto("/settings/calendar?addon=add&error=email_does_not_match");
    await expect(
      page.getByText(
        "That Google account uses a different email from your FaceOn account",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Connect it anyway" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      "Connect a Google account with a different email?",
    );
    await expect(dialog).toContainText(person.user.email);
    await dialog.getByRole("button", { name: "Continue to Google" }).click();

    // Back from Google, the add-on is made.
    await expect(
      page.getByRole("link", { name: /Open in Apps Script/ }),
    ).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.scopes).toEqual([SCRIPT_SCOPE]);
    expect(requests[0]?.loginHint).toBeUndefined();
    expect(requests[0]?.additionalParams?.prompt).toBe(
      "consent select_account",
    );
    // The go-ahead travels to Better Auth's callback only, out of scripts' reach.
    const cookie = (await person.context.cookies()).find(
      ({ name }) => name === "faceon_link_any_email",
    );
    expect(cookie?.path).toBe("/api/auth");
    expect(cookie?.httpOnly).toBe(true);
    expectNoErrors(person);
  });

  test("an older sign-in: sign in again first", async ({ people }) => {
    const person = await people.signedIn({ signedInAgo: "20 minutes" });
    const { page } = person;
    await stubAddon(page);
    const requests = await stubConsent(page, "/settings/calendar?addon=add");

    await page.goto("/settings/calendar?addon=add&error=email_does_not_match");
    await page.getByRole("button", { name: "Connect it anyway" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Continue to Google" }).click();
    await expect(dialog).toContainText("needs a recent sign-in");
    await dialog.getByRole("button", { name: "Sign in again" }).click();

    await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings%2Fcalendar$/);
    expect(requests).toHaveLength(0);
    expectNoErrors(person);
  });

  test("a Google account another account uses: sign in with it instead", async ({
    people,
  }) => {
    const person = await people.signedIn();
    const { page } = person;
    await stubAddon(page);

    await page.goto(
      "/settings/calendar?addon=add&error=account_already_linked_to_different_user",
    );
    await expect(
      page.getByText(
        "That Google account already belongs to another FaceOn account",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in with that Google account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect it anyway" }),
    ).toHaveCount(0);
    expectNoErrors(person);
  });

  test("Calendar sync asks for its own scope", async ({ people }) => {
    const person = await people.signedIn();
    const { page } = person;
    const requests = await stubConsent(page, "/settings/calendar?connected=1");

    await page.goto(
      "/settings/calendar?connected=1&error=email_does_not_match",
    );
    await page.getByRole("button", { name: "Connect it anyway" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Continue to Google" })
      .click();

    await expect(page).toHaveURL(/\/settings\/calendar\?connected=1$/);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.scopes).toEqual([CALENDAR_SCOPE]);
    expect(requests[0]?.loginHint).toBeUndefined();
    expectNoErrors(person);
  });

  test("Settings → Account: Google may, GitHub keeps the same email", async ({
    people,
  }) => {
    const person = await people.signedIn();
    const { page } = person;

    await page.goto(
      "/settings/account?linking=google&error=email_does_not_match",
    );
    await expect(
      page.getByText("That Google account uses a different email"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect it anyway" }),
    ).toBeVisible();

    await page.goto(
      "/settings/account?linking=github&error=email_does_not_match",
    );
    await expect(
      page.getByText(
        "That account uses a different email. Connect one that uses",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect it anyway" }),
    ).toHaveCount(0);
    expectNoErrors(person);
  });

  test("the go-ahead needs a recent sign-in", async ({ people }) => {
    const recent = await people.signedIn();
    const allowed = await recent.page.request.post(
      "/api/integrations/google-link",
    );
    expect(allowed.status()).toBe(204);
    expect(allowed.headers()["set-cookie"]).toContain("faceon_link_any_email=");

    const older = await people.signedIn({ signedInAgo: "20 minutes" });
    const refused = await older.page.request.post(
      "/api/integrations/google-link",
    );
    expect(refused.status()).toBe(403);
    expect(await refused.json()).toEqual({ problem: "signInAgain" });

    const guest = await people.guest();
    const signedOut = await guest.page.request.post(
      "/api/integrations/google-link",
    );
    expect(signedOut.status()).toBe(401);
  });
});
