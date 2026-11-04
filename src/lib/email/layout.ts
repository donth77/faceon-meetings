import { BRAND_COLORS, EMAIL_LOGO_SIZE } from "@/lib/brand";

import { escapeHtml } from "./html";

/*
 * The page every email shares: the logo, the message on a white card, and a footer that
 * names the app and links to its site. Inline styles only, in one column at most 480px
 * wide, which mail apps on phones and computers draw alike. The blocks below make the
 * card's content, and each escapes its own text.
 */

/** The logo `pnpm brand` writes for emails, served from this copy's own site. */
export const EMAIL_LOGO_PATH = "/brand/logo-email.png";

const COLORS = {
  page: "#f5f6f8",
  card: "#ffffff",
  border: "#e2e5ea",
  ink: "#12161c",
  muted: "#4f5966",
};
const FONT = "Figtree,'Segoe UI',Helvetica,Arial,sans-serif";
const BRAND = BRAND_COLORS.light;

/** Fills the rest of an inbox's preview, so it stops after the preheader. */
const PREVIEW_STOP = "&#847;&zwnj;&nbsp;".repeat(40);

export function emailPage(input: {
  /** The email's language. */
  locale: string;
  /** Its heading, as the page's title. */
  title: string;
  /** What inboxes show beside the subject: the message's first sentence. */
  preheader: string;
  appName: string;
  /** This copy's address, for the logo and the footer's link. */
  siteUrl: string;
  /** The card's content, from the blocks below. */
  blocks: string[];
}): string {
  const site = input.siteUrl.replace(/\/$/, "");
  return `<!doctype html>
<html lang="${escapeHtml(input.locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:24px 12px;background:${COLORS.page};color:${COLORS.ink};font-family:${FONT}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${COLORS.page};mso-hide:all">${escapeHtml(input.preheader)}${PREVIEW_STOP}</div>
<div style="max-width:480px;margin:0 auto;padding:32px;border:1px solid ${COLORS.border};border-radius:16px;background:${COLORS.card}">
<div style="margin:0 0 24px"><a href="${escapeHtml(site)}" style="text-decoration:none"><img src="${escapeHtml(site + EMAIL_LOGO_PATH)}" width="${EMAIL_LOGO_SIZE.width}" height="${EMAIL_LOGO_SIZE.height}" alt="${escapeHtml(input.appName)}" style="display:block;border:0;outline:none;font-size:20px;font-weight:700;line-height:${EMAIL_LOGO_SIZE.height}px;color:${BRAND.brand}"></a></div>
${input.blocks.join("\n")}
</div>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:${COLORS.muted};text-align:center">${escapeHtml(input.appName)} · <a href="${escapeHtml(site)}" style="color:${COLORS.muted}">${escapeHtml(new URL(site).host)}</a></p>
</body>
</html>`;
}

/** The message's heading. */
export const emailHeading = (text: string) =>
  `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(text)}</h1>`;

/** A paragraph of the message, with `gap` pixels below it. */
export const emailParagraph = (text: string, gap = 24) =>
  `<p style="margin:0 0 ${gap}px;font-size:15px;line-height:1.5">${escapeHtml(text)}</p>`;

/** Someone's own words, shown as they wrote them. */
export const emailQuote = (text: string) =>
  `<blockquote style="margin:0 0 24px;padding:12px 16px;border-radius:10px;background:${COLORS.page};font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(text)}</blockquote>`;

/** Lines set apart in a box, such as a meeting's topic, time, ID and passcode. */
export const emailDetails = (lines: string[]) =>
  `<div style="margin:0 0 24px;padding:16px;border-radius:12px;background:${COLORS.page}">\n${lines
    .map(
      (line) =>
        `<p style="margin:0 0 6px;font-size:15px;line-height:1.5">${escapeHtml(line)}</p>`,
    )
    .join("\n")}\n</div>`;

/** The message's one button. */
export const emailButton = (label: string, url: string) =>
  `<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:${BRAND.brand};color:${BRAND.brandForeground};font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(label)}</a></p>`;

/**
 * The button's link spelled out, for mail apps that hide buttons. Only the address may
 * break anywhere, so a narrow screen never splits the words before it.
 */
export const emailLinkFallback = (label: string, url: string) =>
  `<p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${COLORS.muted}">${escapeHtml(label)}<br><span style="word-break:break-all">${escapeHtml(url)}</span></p>`;

/** The closing note, with a link after it where there is one. */
export const emailNote = (
  text: string,
  link?: { label: string; url: string },
) =>
  `<p style="margin:0;font-size:13px;line-height:1.5;color:${COLORS.muted}">${escapeHtml(text)}${
    link
      ? ` <a href="${escapeHtml(link.url)}" style="color:${COLORS.muted}">${escapeHtml(link.label)}</a>`
      : ""
  }</p>`;
