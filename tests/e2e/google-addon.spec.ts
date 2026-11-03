import type { Page } from "@playwright/test";

import { expect, expectNoErrors, test } from "./support/fixtures";

/*
 * Settings → Calendar → FaceOn in Google Calendar and Gmail. The tests' server has no
 * Google client, so Google and FaceOn's answers about the add-on are stubbed here: the
 * card's state comes from GET /api/integrations/google-addon, adding and removing it
 * from POST and DELETE, and Google's consent screen from Better Auth's link-social.
 */

const SCRIPT_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const EDITOR = `https://script.google.com/home/projects/${SCRIPT_ID}/edit`;
const SCRIPT_SCOPE = "https://www.googleapis.com/auth/script.projects";

type Reply = {
  addon:
    | { status: "none"; granted: boolean }
    | {
        status: "created" | "connected";
        scriptId: string;
        needsUpdate: boolean;
      };
  problem?: string;
  consoleUrl?: string;
};

const none = (granted = false): Reply => ({
  addon: { status: "none", granted },
});
const created: Reply = {
  addon: { status: "created", scriptId: SCRIPT_ID, needsUpdate: false },
};
const connected = (needsUpdate = false): Reply => ({
  addon: { status: "connected", scriptId: SCRIPT_ID, needsUpdate },
});

/** Answers the card's requests, and notes them ("GET", "POST add", "DELETE"). */
async function stubAddon(
  page: Page,
  answers: { get: Reply; post?: Reply; remove?: Reply },
): Promise<string[]> {
  const seen: string[] = [];
  await page.route("**/api/integrations/google-addon", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "POST") {
      const { action } = request.postDataJSON() as { action: string };
      seen.push(`POST ${action}`);
      return answers.post
        ? route.fulfill({ json: answers.post })
        : route.fulfill({ status: 503 });
    }
    seen.push(method);
    if (method === "DELETE") {
      return answers.remove
        ? route.fulfill({ json: answers.remove })
        : route.fulfill({ status: 503 });
    }
    return route.fulfill({ json: answers.get });
  });
  return seen;
}

test.describe("Settings → Calendar: FaceOn in Google Calendar and Gmail", () => {
  test("adding it: Google's consent, then how to install it", async ({
    people,
  }) => {
    const person = await people.signedIn();
    const { page } = person;
    const seen = await stubAddon(page, { get: none(), post: created });
    // Google's consent screen comes straight back to Settings, as Google does.
    let scopes: string[] = [];
    await page.route("**/api/auth/link-social", async (route) => {
      ({ scopes } = route.request().postDataJSON() as { scopes: string[] });
      const back = new URL("/settings/calendar?addon=add", page.url());
      await route.fulfill({ json: { url: back.toString(), redirect: true } });
    });

    await page.goto("/settings/calendar");
    await expect(
      page.getByText("Add FaceOn to Google Calendar and Gmail"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add FaceOn" }).click();

    const open = page.getByRole("link", { name: /Open in Apps Script/ });
    await expect(open).toHaveAttribute("href", EDITOR);
    await expect(open).toBeFocused();
    expect(scopes).toEqual([SCRIPT_SCOPE]);
    expect(seen).toContain("POST add");
    await expect(
      page.getByText(
        "In Apps Script, select Deploy, then Test deployments, then Install.",
      ),
    ).toBeVisible();
    // Reloading doesn't add another.
    await expect(page).toHaveURL(/\/settings\/calendar$/);
    expectNoErrors(person);
  });

  test("added: open Google Calendar, or remove it", async ({ people }) => {
    const person = await people.signedIn();
    const { page } = person;
    const seen = await stubAddon(page, {
      get: connected(),
      remove: none(true),
    });

    await page.goto("/settings/calendar");
    await expect(
      page.getByText("FaceOn is in your Google Calendar and Gmail"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open Google Calendar/ }),
    ).toHaveAttribute("href", "https://calendar.google.com/");

    await page
      .getByRole("button", {
        name: "Remove FaceOn from Google Calendar and Gmail",
      })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("uninstall it in Apps Script");
    await dialog.getByRole("button", { name: "Remove" }).click();

    // What's left to do in Google, with the way there.
    const note = page.getByRole("status").filter({ hasText: "Uninstall" });
    await expect(note).toBeVisible();
    await expect(
      note.getByRole("link", { name: /Open in Apps Script/ }),
    ).toHaveAttribute("href", EDITOR);
    await expect(
      page.getByRole("button", { name: "Add FaceOn" }),
    ).toBeVisible();
    expect(seen).toContain("DELETE");
    expectNoErrors(person);
  });

  test("Google's refusals: the Apps Script API off, consent declined", async ({
    people,
  }) => {
    const person = await people.signedIn();
    const { page } = person;
    // Google already allowed it: adding goes straight to FaceOn.
    const seen = await stubAddon(page, {
      get: none(true),
      post: { ...none(true), problem: "userApiOff" },
    });

    await page.goto("/settings/calendar");
    await page.getByRole("button", { name: "Add FaceOn" }).click();
    await expect(
      page.getByText(/turn on the Apps Script API for your Google account/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open Apps Script settings/ }),
    ).toHaveAttribute("href", "https://script.google.com/home/usersettings");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(seen).toContain("POST add");

    // Declined on Google's screen: nothing is added.
    const declined = await stubAddon(page, { get: none() });
    await page.goto("/settings/calendar?addon=add&error=access_denied");
    await expect(
      page.getByText("FaceOn wasn’t added to Google Calendar and Gmail."),
    ).toBeVisible();
    expect(declined.filter((call) => call.startsWith("POST"))).toEqual([]);
    expectNoErrors(person);
  });

  test("from the desktop app: the browser's page, signed in first", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const here = "/desktop/calendar?addon=add&for=someone";
    await visitor.page.goto(here);
    await expect(
      visitor.page.getByRole("heading", {
        name: "Add FaceOn to Google Calendar and Gmail",
      }),
    ).toBeVisible();
    await expect(
      visitor.page.getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(here)}`);
    expectNoErrors(visitor);
  });

  test("when Google stopped FaceOn updating it: Update the add-on", async ({
    people,
  }) => {
    const person = await people.signedIn();
    const { page } = person;
    await stubAddon(page, { get: connected(true) });

    await page.goto("/settings/calendar");
    await expect(page.getByText("Update your add-on")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update the add-on" }),
    ).toBeVisible();
    expectNoErrors(person);
  });
});
