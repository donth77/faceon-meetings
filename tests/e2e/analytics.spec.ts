import type { Page } from "@playwright/test";

import {
  ORDINARY_CHROME,
  recordPageViews,
  type PageViewBody,
} from "./support/analytics";
import {
  createMeeting,
  createPastMeeting,
  createScheduledMeeting,
  sessionOf,
} from "./support/db";
import {
  expect,
  expectNoErrors,
  needsAnalytics,
  test,
} from "./support/fixtures";

/** Everything Vercel's script may send about a page view. */
const SENT = new Set(["o", "sv", "sdkn", "sdkv", "dp", "r"]);

const TOKEN = "eyJ1IjoiZTJlIn0.dGhlLXRva2Vucy1zaWduYXR1cmU";
const STATE = "e2e-state-0123456789abcdef";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const EMAIL = "riley.e2e@example.com";
const SEARCH = "passcode reset";

/** A new page load at `address`, and the page view it sent. */
async function visit(page: Page, address: string): Promise<PageViewBody> {
  const sent = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/_vercel/insights/view" &&
      request.method() === "POST",
  );
  await page.goto(address);
  return (await sent).postDataJSON() as PageViewBody;
}

/**
 * A page view names its page by route, on this site, and says nothing else: no
 * referrer from this site, nothing about the person.
 */
function expectView(
  view: PageViewBody,
  site: string,
  route: string,
  matched = route,
) {
  expect(view).toMatchObject({
    o: `${site}${route}`,
    dp: matched,
    sdkn: "@vercel/analytics/next",
  });
  expect(Object.keys(view).filter((key) => !SENT.has(key))).toEqual([]);
  expect(view.r ?? "").toBe("");
}

/** None of `secrets` appears anywhere in what was sent. */
function expectNoneOf(views: PageViewBody[], secrets: string[]) {
  const sent = JSON.stringify(views);
  for (const secret of secrets) expect(sent).not.toContain(secret);
}

test.describe("page views", () => {
  test.beforeEach(() => needsAnalytics());

  test("a visitor's reach Vercel as each page's route: no meeting ID, passcode, token, address or search", async ({
    people,
    baseURL,
  }) => {
    const site = baseURL ?? "";
    const host = await people.signedIn();
    const meeting = await createMeeting(host.user.id);
    const visitor = await people.guest({ userAgent: ORDINARY_CHROME });
    const { page } = visitor;
    const { views, other } = await recordPageViews(page);

    expectView(
      await visit(page, `/j/${meeting.code}#pwd=${meeting.passcode}`),
      site,
      "/j/[code]",
    );
    await expect(page.getByLabel("Your name")).toBeVisible();

    for (const [address, route] of [
      [`/unsubscribe?token=${TOKEN}`, "/unsubscribe"],
      [`/reset-password?token=${TOKEN}`, "/reset-password"],
      [
        `/verify-email?error=INVALID_TOKEN&next=${encodeURIComponent(`/j/${meeting.code}`)}`,
        "/verify-email",
      ],
      [
        `/desktop/sign-in?state=${STATE}&challenge=${CHALLENGE}`,
        "/desktop/sign-in",
      ],
      [`/desktop/calendar?for=${host.user.id}&addon=add`, "/desktop/calendar"],
      [`/sign-up?email=${encodeURIComponent(EMAIL)}`, "/sign-up"],
      [
        `/sign-in?next=${encodeURIComponent(`/j/${meeting.code}#pwd=${meeting.passcode}`)}`,
        "/sign-in",
      ],
    ] as const) {
      expectView(await visit(page, address), site, route);
    }

    // Help articles count by name, without the search that found them.
    expectView(
      await visit(page, `/help/meeting-limits?q=${encodeURIComponent(SEARCH)}`),
      site,
      "/help/meeting-limits",
      "/help/[slug]",
    );

    // A mistyped link counts as the not-found page, whatever was typed into it.
    expectView(
      await visit(page, `/j/${meeting.code}/${meeting.passcode}`),
      site,
      "/[...rest]",
    );

    // Leaving a page whose address holds a token: this site's addresses never go as the
    // referrer.
    await visit(page, `/reset-password?token=${TOKEN}`);
    const next = page.waitForRequest("**/_vercel/insights/view");
    await page.evaluate(() => {
      setTimeout(() => window.location.assign("/privacy"));
    });
    await page.waitForURL("**/privacy");
    expect(await page.evaluate(() => document.referrer)).toContain(TOKEN);
    const fromHere = (await next).postDataJSON() as PageViewBody;
    expectView(fromHere, site, "/privacy");
    expect(fromHere).not.toHaveProperty("r");

    // One page view for each page, and nothing more.
    await expect.poll(() => views.length).toBe(12);
    expectNoneOf(views, [
      meeting.code,
      meeting.passcode,
      TOKEN,
      STATE,
      CHALLENGE,
      host.user.id,
      EMAIL,
      encodeURIComponent(EMAIL),
      "passcode",
      "INVALID_TOKEN",
      "?",
      "#",
    ]);
    expect(other).toEqual([]);
    expectNoErrors(visitor);
  });

  test("a host's reach Vercel as each page's route, as they load and as the host moves between them", async ({
    people,
    baseURL,
  }) => {
    const site = baseURL ?? "";
    const host = await people.signedIn({ userAgent: ORDINARY_CHROME });
    const { page } = host;
    const scheduled = await createScheduledMeeting(host.user.id, {
      title: "Page views",
      startsInMinutes: 120,
    });
    const past = await createPastMeeting(host.user, {
      minutes: 20,
      guestName: "Riley Guest",
    });
    const sessionId = await sessionOf(past.id);
    const occurrence = new Date(Date.now() + 2 * 3_600_000).toISOString();
    const { views, other } = await recordPageViews(page);

    for (const [address, route] of [
      [`/meetings/${scheduled.code}`, "/meetings/[code]"],
      [
        `/meetings/${scheduled.code}/edit?occurrence=${encodeURIComponent(occurrence)}`,
        "/meetings/[code]/edit",
      ],
      [`/schedule?again=${past.code}`, "/schedule"],
      [`/previous/${sessionId}/notes`, "/previous/[sessionId]/notes"],
      [
        "/settings/calendar?connected=1&addon=add&error=access_denied",
        "/settings/calendar",
      ],
    ] as const) {
      expectView(await visit(page, address), site, route);
    }

    // Moving between pages in the app counts each, the same way.
    expectView(await visit(page, "/home"), site, "/home");
    const moved = page.waitForRequest("**/_vercel/insights/view");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Previous" })
      .click();
    await expect(page).toHaveURL(/\/previous$/);
    const view = (await moved).postDataJSON() as PageViewBody;
    expectView(view, site, "/previous");
    expect(view).not.toHaveProperty("r");

    // One page view for each page, and nothing more.
    await expect.poll(() => views.length).toBe(7);
    expectNoneOf(views, [
      scheduled.code,
      past.code,
      sessionId,
      occurrence,
      encodeURIComponent(occurrence),
      host.user.id,
      host.user.email,
      "access_denied",
      "?",
      "#",
    ]);
    expect(other).toEqual([]);
    expectNoErrors(host);
  });
});
