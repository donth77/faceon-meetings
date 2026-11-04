import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PAGE_ROUTES, pageRoute, pageView } from "./page-views";

const SITE = "https://joinfaceon.app";
const CODE = "1234567890";
const PASSCODE = "K7XQ2M";
const SESSION = "0b0f9c1e-5a4b-4c3d-9e8f-7a6b5c4d3e2f";
const TOKEN = "eyJ1IjoiYWRhIn0.c2lnbmF0dXJlLW9mLXRoZS10b2tlbg";
const EMAIL = "ada%40example.com";

/** The address a page view at `address` reaches Vercel with. */
const sent = (address: string) =>
  pageView({ type: "pageview", url: `${SITE}${address}` })?.url;

describe("pageView", () => {
  it.each([
    // Meeting links, with the passcode as invitations carry it and as people paste it.
    [`/j/${CODE}#pwd=${PASSCODE}`, "/j/[code]"],
    [`/j/${CODE}?pwd=${PASSCODE}`, "/j/[code]"],
    ["/j/123-456-7890", "/j/[code]"],
    // A meeting's page, and editing one occurrence of a series.
    [`/meetings/${CODE}`, "/meetings/[code]"],
    [
      `/meetings/${CODE}/edit?occurrence=2026-11-05T15%3A00%3A00.000Z`,
      "/meetings/[code]/edit",
    ],
    [`/schedule?again=${CODE}`, "/schedule"],
    // Previous, and a past meeting's notes.
    ["/previous?page=3", "/previous"],
    [`/previous/${SESSION}/notes`, "/previous/[sessionId]/notes"],
    // The links in emails: stopping reminders, a new password, a verified address.
    [`/unsubscribe?token=${TOKEN}`, "/unsubscribe"],
    [`/reset-password?token=${TOKEN}`, "/reset-password"],
    [`/verify-email?next=%2Fj%2F${CODE}&error=INVALID_TOKEN`, "/verify-email"],
    // Signing in and up, coming back to a meeting, or from a host's invitation.
    [`/sign-in?next=%2Fj%2F${CODE}%23pwd%3D${PASSCODE}`, "/sign-in"],
    [`/sign-up?email=${EMAIL}&next=%2Fhome`, "/sign-up"],
    // The desktop app signing in through the browser, and connecting Calendar for it.
    [
      `/desktop/sign-in?state=${TOKEN}&challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&provider=google`,
      "/desktop/sign-in",
    ],
    [`/desktop/calendar?for=${SESSION}&addon=add`, "/desktop/calendar"],
    ["/desktop/welcome", "/desktop/welcome"],
    // Google Calendar and the add-on coming back to Settings, and linking accounts.
    [
      "/settings/calendar?popup=1&connected=1&addon=added&error=access_denied",
      "/settings/calendar",
    ],
    [`/settings/account?linking=${TOKEN}&error=1`, "/settings/account"],
    // Admins' searches can be addresses.
    [`/settings/admin?q=${EMAIL}&page=2#usage`, "/settings/admin"],
  ])("sends %s as %s", (address, route) => {
    expect(sent(address)).toBe(`${SITE}${route}`);
  });

  it("counts Help articles by name, without the search that found them", () => {
    expect(sent("/help/meeting-limits?q=passcode")).toBe(
      `${SITE}/help/meeting-limits`,
    );
    expect(sent(`/help?q=${EMAIL}`)).toBe(`${SITE}/help`);
    // Anything but an article's kind of name stays a slug.
    expect(sent(`/help/${CODE}`)).toBe(`${SITE}/help/[slug]`);
    expect(sent(`/help/${EMAIL}`)).toBe(`${SITE}/help/[slug]`);
    expect(sent("/help/Meeting-Limits")).toBe(`${SITE}/help/[slug]`);
  });

  it("counts any other path as the not-found page", () => {
    for (const address of [
      `/j/${CODE}/${PASSCODE}`,
      `/reset-password/${TOKEN}`,
      `/previous/${SESSION}`,
      `/meetings/${CODE}/edit/again`,
      "/Home",
      `/${EMAIL}`,
    ]) {
      expect(sent(address), address).toBe(`${SITE}/[...rest]`);
    }
  });

  it("keeps the site's origin, the home page and plain pages as they are", () => {
    expect(sent("/")).toBe(`${SITE}/`);
    expect(sent("/download?ref=launch")).toBe(`${SITE}/download`);
    expect(
      pageView({ type: "pageview", url: "http://localhost:3100/home#top" })
        ?.url,
    ).toBe("http://localhost:3100/home");
  });

  it("keeps what Vercel's script passes along beside the address", () => {
    const event = {
      type: "pageview" as const,
      url: `${SITE}/j/${CODE}`,
      payload: undefined,
    };
    expect(pageView(event)).toEqual({ ...event, url: `${SITE}/j/[code]` });
  });

  it("drops events, and addresses it can't read", () => {
    expect(pageView({ type: "event", url: `${SITE}/home` })).toBeNull();
    expect(pageView({ type: "pageview", url: "/j/1234567890" })).toBeNull();
    expect(pageView({ type: "pageview", url: "" })).toBeNull();
  });
});

describe("pageRoute", () => {
  it("prefers a static segment to a dynamic one, and either to the catch-all", () => {
    expect(pageRoute("/help")).toBe("/help");
    expect(pageRoute("/settings/admin")).toBe("/settings/admin");
    expect(pageRoute("/admin")).toBe("/admin");
    expect(pageRoute(`/meetings/${CODE}`)).toBe("/meetings/[code]");
    expect(pageRoute("/nowhere")).toBe("/[...rest]");
  });

  it("reads paths the way the router does: extra slashes and case", () => {
    expect(pageRoute(`//j//${CODE}/`)).toBe("/j/[code]");
    expect(pageRoute("")).toBe("/");
    expect(pageRoute("/J/1234567890")).toBe("/[...rest]");
  });

  it("matches every route to itself", () => {
    for (const route of PAGE_ROUTES) {
      const example = route.replace(/\[(?:\.\.\.)?\w+\]/g, CODE);
      expect(pageRoute(example), route).toBe(route);
    }
  });
});

/** The pages in src/app/[locale], as routes: no locale, no route groups. */
function appPages(): string[] {
  const root = path.resolve("src/app/[locale]");
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /^page\.(tsx?|jsx?|mdx)$/.test(path.basename(file)))
    .map((file) => {
      const segments = path
        .dirname(file)
        .split(path.sep)
        .filter((segment) => segment !== "." && !/^\(.+\)$/.test(segment));
      return `/${segments.join("/")}`;
    })
    .sort();
}

describe("PAGE_ROUTES", () => {
  it("lists every page the app has, and nothing else", () => {
    expect([...PAGE_ROUTES].sort()).toEqual(appPages());
  });
});
