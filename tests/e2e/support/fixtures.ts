import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type ViewportSize,
} from "@playwright/test";

import { standInForAnalytics } from "./analytics";
import { createUser, deleteUsers, type TestUser } from "./db";
import { hasAnalytics, hasHumanCheck, hasStream } from "./env";
import { fakeHumanCheck } from "./human-check";

export { expect };

/**
 * Waits until React has hydrated this element, so it acts on clicks and keys. Before that
 * a form submits the browser's own way and reloads the page, which a busy test runner can
 * catch (a Join pressed straight after the landing page loads). React marks the elements
 * it has taken over with its own properties.
 */
export async function hydrated(locator: Locator): Promise<void> {
  const element = await locator.elementHandle();
  await locator
    .page()
    .waitForFunction(
      (node) =>
        node !== null &&
        Object.keys(node).some((key) => key.startsWith("__reactProps$")),
      element,
    );
}

/** Someone in the test: a browser of their own, and their account if they have one. */
export type Person = {
  page: Page;
  context: BrowserContext;
  user?: TestUser;
  /**
   * Console errors, Content Security Policy violations and uncaught exceptions on their
   * page so far.
   */
  errors: string[];
};

type OpenOptions = {
  viewport?: ViewportSize;
  userAgent?: string;
  /** Device pixels per CSS pixel: 2 for a Retina screen. */
  deviceScaleFactor?: number;
};

export type People = {
  /** A new account, signed in, in a browser of its own. */
  signedIn(
    options?: OpenOptions & Parameters<typeof createUser>[0],
  ): Promise<Person & { user: TestUser }>;
  /** Someone without an account. */
  guest(options?: OpenOptions): Promise<Person>;
};

/**
 * Messages that aren't the app's fault: a browser's own note about a failed request is
 * reported separately when it matters (the test checks the response instead); Stream's
 * servers sometimes send one more message on a connection that's already closing, as a
 * meeting ends; and now and then, as a camera stream with an effect stops, Chromium lets
 * go of a frame it made but never handed to the page (the effects close every frame they
 * read or make), then warns that nobody closed it.
 */
const NOT_OURS = [
  /^Failed to load resource/,
  /^WebSocket connection to 'wss:\/\/[^/']*\.stream-io-api\.com\/[^']*' failed: Data frame received after close$/,
  /^A VideoFrame was garbage collected without being closed\./,
];

/**
 * While the Content Security Policy only reports, Chromium logs what it would block as
 * info, not as an error: counted all the same, so nothing a page needs is missing from
 * the policy when it's enforced.
 */
const CSP_VIOLATION =
  /violates the following Content Security Policy directive/;

function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() !== "error" && !CSP_VIOLATION.test(text)) return;
    if (!NOT_OURS.some((pattern) => pattern.test(text))) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

export const test = base.extend<{ people: People }>({
  people: async ({ browser, baseURL }, provide) => {
    const contexts: BrowserContext[] = [];
    const users: TestUser[] = [];
    const host = new URL(baseURL ?? "http://localhost").hostname;

    const open = async (user: TestUser | undefined, options: OpenOptions) => {
      const context = await browser.newContext({
        baseURL,
        viewport: options.viewport ?? { width: 1280, height: 800 },
        ...(options.userAgent ? { userAgent: options.userAgent } : {}),
        ...(options.deviceScaleFactor
          ? { deviceScaleFactor: options.deviceScaleFactor }
          : {}),
        locale: "en-US",
        timezoneId: "America/New_York",
        permissions:
          browser.browserType().name() === "chromium"
            ? ["camera", "microphone"]
            : [],
      });
      contexts.push(context);
      if (user) {
        await context.addCookies([{ ...user.cookie, domain: host, path: "/" }]);
      }
      // Cloudflare's script is a stand-in whose checks pass (support/human-check.ts).
      await fakeHumanCheck(context);
      // So is Vercel Web Analytics', which counts nothing (support/analytics.ts).
      await standInForAnalytics(context);
      const page = await context.newPage();
      return { page, context, user, errors: watch(page) };
    };

    await provide({
      async signedIn(options = {}) {
        const user = await createUser(options);
        users.push(user);
        return (await open(user, options)) as Person & { user: TestUser };
      },
      guest: (options = {}) => open(undefined, options),
    });

    await Promise.all(contexts.map((context) => context.close()));
    await deleteUsers(users.map((user) => user.id));
  },
});

/** For tests that join a real call: they need Stream's development keys. */
export function needsStream() {
  test.skip(!hasStream, "Stream's development keys aren't set");
}

/** For tests of the check for a person: the build needs a Turnstile site key. */
export function needsHumanCheck() {
  test.skip(!hasHumanCheck, "The build has no Turnstile site key");
}

/** For tests of page views: the build needs NEXT_PUBLIC_VERCEL_ANALYTICS=1. */
export function needsAnalytics() {
  test.skip(!hasAnalytics, "The build doesn't count page views");
}

/** No console errors or uncaught exceptions on anyone's page. */
export function expectNoErrors(...people: Person[]) {
  expect(people.flatMap((person) => person.errors)).toEqual([]);
}
