import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type ViewportSize,
} from "@playwright/test";

import { createUser, deleteUsers, type TestUser } from "./db";
import { hasStream } from "./env";

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
  /** Console errors and uncaught exceptions on their page so far. */
  errors: string[];
};

type OpenOptions = { viewport?: ViewportSize; userAgent?: string };

type People = {
  /** A new account, signed in, in a browser of its own. */
  signedIn(
    options?: OpenOptions & Parameters<typeof createUser>[0],
  ): Promise<Person & { user: TestUser }>;
  /** Someone without an account. */
  guest(options?: OpenOptions): Promise<Person>;
};

/**
 * Messages that aren't the app's fault: a browser's own note about a failed request is
 * reported separately when it matters (the test checks the response instead).
 */
const NOT_OURS = [/^Failed to load resource/];

function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
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

/** No console errors or uncaught exceptions on anyone's page. */
export function expectNoErrors(...people: Person[]) {
  expect(people.flatMap((person) => person.errors)).toEqual([]);
}
