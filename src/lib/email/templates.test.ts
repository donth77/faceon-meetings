import type { Locale } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { siteUrl } from "@/lib/site";

import { EMAIL_LOGO_PATH } from "./layout";
import { accountEmail } from "./templates";

// The email's words come from messages/en.json, as they would on the server.
vi.mock("next-intl/server", async () => {
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const { createTranslator } = await import("next-intl");
  const messages = JSON.parse(
    readFileSync(path.join(process.cwd(), "messages", "en.json"), "utf8"),
  );
  return {
    getTranslations: async (options: { locale: Locale; namespace: string }) =>
      createTranslator({
        locale: options.locale,
        messages,
        namespace: options.namespace as never,
      }),
  };
});

const url =
  "https://joinfaceon.app/api/auth/verify-email?token=abc&callbackURL=%2F";

describe("an account email", () => {
  it("comes in the shared layout: the logo, the first sentence as the preview, the footer", async () => {
    const { html } = await accountEmail("verify", {
      to: "alex@example.com",
      name: "Alex",
      url,
      locale: "en",
    });
    expect(html).toContain(`<img src="${siteUrl()}${EMAIL_LOGO_PATH}"`);
    expect(html).toMatch(
      /<div style="display:none;[^"]*">Hi Alex, confirm your email to finish creating your \w+ account\./,
    );
    expect(html).toContain(`<a href="${siteUrl()}" style="color:#4f5966">`);
    expect(html).toContain(
      '<span style="word-break:break-all">https://joinfaceon.app/api/auth/verify-email?token=abc&amp;callbackURL=%2F</span>',
    );
  });

  it("keeps the plain text as it was: heading, sentence, the link, the note", async () => {
    const { text, subject } = await accountEmail("verify", {
      to: "alex@example.com",
      name: "Alex",
      url,
      locale: "en",
    });
    expect(subject).toMatch(/^Confirm your email for /);
    expect(text.split("\n\n")).toEqual([
      "Confirm your email",
      expect.stringMatching(/^Hi Alex, confirm your email/),
      `Confirm email: ${url}`,
      "If you didn’t create an account, you can ignore this email.",
    ]);
  });

  it("shows someone's own words as they wrote them, escaped", async () => {
    const { html, text } = await accountEmail("hostingAsked", {
      to: "admin@example.com",
      name: "Alex",
      url: "https://joinfaceon.app/settings/admin",
      locale: "en",
      values: { email: "alex@example.com" },
      quote: "Our <club> meets weekly & runs long",
    });
    expect(html).toContain(
      'white-space:pre-wrap">Our &lt;club&gt; meets weekly &amp; runs long</blockquote>',
    );
    expect(text).toContain('"Our <club> meets weekly & runs long"');
  });

  it("invites an approved address in the inviting admin's words: who, the terms, sign-up with the address filled in", async () => {
    const link = "https://joinfaceon.app/sign-up?email=ana%40example.com";
    const { subject, text, html } = await accountEmail("hostInvite", {
      to: "ana@example.com",
      name: "Ada Admin",
      url: link,
      locale: "en",
      values: { admin: "Ada Admin", people: 100, minutes: 0 },
      quote: "Welcome to the <book> club",
    });
    expect(subject).toMatch(/^Ada Admin invited you to host meetings on /);
    expect(text.split("\n\n")).toEqual([
      expect.stringMatching(/^You’re invited to host meetings on /),
      expect.stringMatching(
        /^Ada Admin invited you to host full meetings on .+: up to 100 people, with no time limit\. Create your account/,
      ),
      '"Welcome to the <book> club"',
      `Create your account: ${link}`,
      expect.stringMatching(
        /^Signing in with Google or GitHub with this same address works too\./,
      ),
    ]);
    expect(html).toContain(`href="${link}"`);
    expect(html).toContain("Welcome to the &lt;book&gt; club");
  });
});
