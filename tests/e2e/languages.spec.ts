import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createMeeting } from "./support/db";
import { hasStream } from "./support/env";
import {
  expect,
  expectNoErrors,
  hydrated,
  test,
  type Person,
} from "./support/fixtures";
import { openMeeting } from "./support/meeting";

/** Every language FaceOn ships: one message file each. */
const LOCALES = readdirSync("messages")
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -".json".length));

type Messages = Record<string, Record<string, string>>;
const messagesIn = (locale: string): Messages =>
  JSON.parse(readFileSync(path.join("messages", `${locale}.json`), "utf8"));

/** A message as the page shows it, with the app's name filled in. */
const shown = (text: string | undefined) =>
  (text ?? "").replaceAll("{appName}", "FaceOn");

/** Chooses a language the way the language menu does: its cookie. */
async function speak(person: Person, locale: string, baseURL: string) {
  await person.context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: locale,
      domain: new URL(baseURL).hostname,
      path: "/",
    },
  ]);
}

/** The page is in the language, top to bottom: <html lang> and its main heading. */
async function expectPageIn(person: Person, locale: string, heading: string) {
  const { page } = person;
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(
    heading,
  );
}

for (const locale of LOCALES) {
  test.describe(`in ${locale}`, () => {
    const m = messagesIn(locale);

    test("the public pages", async ({ people, baseURL }) => {
      const visitor = await people.guest();
      await speak(visitor, locale, baseURL!);
      const { page } = visitor;
      for (const [route, heading] of [
        ["/", m.Landing?.headline],
        ["/sign-in", m.Auth?.signInTitle],
        ["/help", m.Help?.title],
      ] as const) {
        await page.goto(route);
        await expectPageIn(visitor, locale, shown(heading));
      }
      expectNoErrors(visitor);
    });

    test("?hl= shows a page in a language without changing the visitor's", async ({
      people,
    }) => {
      const visitor = await people.guest();
      const { page } = visitor;
      await page.goto(`/help?hl=${locale}`);
      await expectPageIn(visitor, locale, shown(m.Help?.title));
      await page.goto("/help");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      expectNoErrors(visitor);
    });

    test("the signed-in pages", async ({ people, baseURL }) => {
      const person = await people.signedIn();
      await speak(person, locale, baseURL!);
      const { page } = person;
      for (const [route, heading] of [
        ["/home", m.Home?.title],
        ["/upcoming", m.Upcoming?.title],
        ["/previous", m.Previous?.title],
      ] as const) {
        await page.goto(route);
        await expectPageIn(person, locale, shown(heading));
      }
      expectNoErrors(person);
    });

    test("the meeting's pre-join screen, and the room when it can join", async ({
      people,
      baseURL,
    }) => {
      const host = await people.signedIn();
      await speak(host, locale, baseURL!);
      const { page } = host;
      const meeting = await createMeeting(host.user.id);
      await openMeeting(page, meeting);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByText(shown(m.PreJoin?.readyToJoin))).toBeVisible();
      const join = page.getByRole("button", {
        name: shown(m.PreJoin?.joinNow),
      });
      await expect(join).toBeVisible();
      if (hasStream) {
        await hydrated(join);
        await join.click();
        await expect(
          page.getByRole("button", { name: shown(m.Meeting?.leave) }),
        ).toBeVisible({ timeout: 60_000 });
      }
      expectNoErrors(host);
    });
  });
}

/** A language other than English, when FaceOn ships one. */
const other = LOCALES.find((locale) => locale !== "en");

/** A language's name as the language menu lists it ("Deutsch", "Español"). */
function nativeName(locale: string): string {
  const name =
    new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

test.describe("choosing a language", () => {
  test.skip(!other, "FaceOn ships only English so far");

  test("follows the browser's languages, a regional variant included", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await page.setExtraHTTPHeaders({
      "accept-language": `sv-SE,${other!.split("-")[0]}-ZZ;q=0.8,en;q=0.5`,
    });
    await page.goto("/help");
    await expect(page.locator("html")).toHaveAttribute("lang", other!);
    expectNoErrors(visitor);
  });

  test("the language menu switches, and the choice stays", async ({
    people,
  }) => {
    const visitor = await people.guest();
    const { page } = visitor;
    await page.goto("/help");
    const menu = page.getByRole("button", { name: /English/ });
    await hydrated(menu);
    await menu.click();
    await page.getByRole("menuitemradio", { name: nativeName(other!) }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", other!);
    await page.goto("/privacy");
    await expect(page.locator("html")).toHaveAttribute("lang", other!);
    expectNoErrors(visitor);
  });
});
