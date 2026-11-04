import { describe, expect, it } from "vitest";

import { EMAIL_LOGO_SIZE } from "@/lib/brand";

import {
  EMAIL_LOGO_PATH,
  emailButton,
  emailLinkFallback,
  emailNote,
  emailPage,
  emailParagraph,
} from "./layout";

const page = (overrides: Partial<Parameters<typeof emailPage>[0]> = {}) =>
  emailPage({
    locale: "en",
    title: "Confirm your email",
    preheader: "Hi Alex, confirm your email to finish creating your account.",
    appName: "FaceOn",
    siteUrl: "https://joinfaceon.app",
    blocks: [emailParagraph("The message.")],
    ...overrides,
  });

describe("the page every email shares", () => {
  it("shows the logo from this copy's own site, at its size, named for blocked images", () => {
    const html = page({ siteUrl: "https://meet.example.org/" });
    expect(html).toContain(
      `<img src="https://meet.example.org${EMAIL_LOGO_PATH}" width="${EMAIL_LOGO_SIZE.width}" height="${EMAIL_LOGO_SIZE.height}" alt="FaceOn"`,
    );
  });

  it("opens with a hidden preheader, so inboxes preview the first sentence", () => {
    const html = page();
    const body = html.slice(html.indexOf("<body"));
    expect(body).toMatch(
      /^<body[^>]*>\n<div style="display:none;[^"]*">Hi Alex, confirm your email to finish creating your account\./,
    );
    expect(body.indexOf("Hi Alex")).toBeLessThan(body.indexOf("<img"));
  });

  it("ends with the app's name and a link to its site", () => {
    expect(page()).toContain(
      'FaceOn · <a href="https://joinfaceon.app" style="color:#4f5966">joinfaceon.app</a></p>\n</body>',
    );
  });

  it("puts the blocks on the card, in order", () => {
    const html = page({
      blocks: [emailParagraph("First."), emailParagraph("Second.")],
    });
    expect(html.indexOf("First.")).toBeLessThan(html.indexOf("Second."));
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("First."));
  });

  it("escapes everything it's given", () => {
    const html = page({
      title: "<b>Plans</b>",
      preheader: "Fish & chips",
      appName: 'Acme "Meet"',
    });
    expect(html).toContain("<title>&lt;b&gt;Plans&lt;/b&gt;</title>");
    expect(html).toContain("Fish &amp; chips");
    expect(html).toContain('alt="Acme &quot;Meet&quot;"');
    expect(html).not.toContain("<b>Plans</b>");
    expect(emailButton("Join", 'https://x.test/?a=1&b="2"')).toContain(
      'href="https://x.test/?a=1&amp;b=&quot;2&quot;"',
    );
  });
});

describe("an email's blocks", () => {
  it("let only the spelled-out address break anywhere, never the words before it", () => {
    const html = emailLinkFallback(
      "If the button doesn’t work, copy this link into your browser:",
      "https://joinfaceon.app/api/auth/verify-email?token=abc",
    );
    expect(html).toMatch(/^<p style="(?![^"]*break-all)[^"]*">If the button/);
    expect(html).toContain(
      '<br><span style="word-break:break-all">https://joinfaceon.app/api/auth/verify-email?token=abc</span>',
    );
  });

  it("put a note's link after it", () => {
    expect(
      emailNote("You’re getting this because reminders are on.", {
        label: "Stop reminder emails",
        url: "https://joinfaceon.app/unsubscribe?token=abc",
      }),
    ).toContain(
      'reminders are on. <a href="https://joinfaceon.app/unsubscribe?token=abc"',
    );
    expect(emailNote("Nothing has changed.")).not.toContain("<a ");
  });
});
