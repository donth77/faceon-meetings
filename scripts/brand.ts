/**
 * `pnpm brand` makes a copy's logo files, icons, link preview and brand colors from
 * brand/brand.json: a name, one color and a mark (SVG). DEPLOY.md, "Make it yours".
 *
 *   pnpm brand                    write everything listed in OUTPUTS below
 *   pnpm brand --try "#0f766e"    show the colors one brand color gives, and their contrast
 *
 * It writes nothing when a color fails WCAG 2.2 AA contrast, and says what to change.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

import { readConfig } from "./brand/config.ts";
import { ico, iconSvg, measureInk, renderPng } from "./brand/images.ts";
import {
  classify,
  escapeXml,
  formatBox,
  num,
  oneColor,
  paints,
  readMark,
  recolor,
  squareAround,
  svgDocument,
  type Mark,
} from "./brand/svg.ts";
import {
  contrastChecks,
  derivePalette,
  failing,
  suggestBrand,
  SURFACES,
  THEMES,
  type BrandTokens,
  type Check,
  type Palette,
} from "./brand/tokens.ts";
import {
  capHeightOf,
  layoutWord,
  loadFont,
  textLine,
  wordPaths,
} from "./brand/wordmark.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = resolve(ROOT, "brand/fonts");

/** The link preview's text is in the app's own font, Figtree. */
const PREVIEW_FONTS = {
  title: resolve(FONTS, "Figtree-Bold.ttf"),
  subtitle: resolve(FONTS, "Figtree-Medium.ttf"),
};

/** Brand SVGs write colors in capitals, as the logo kit always has. */
const paint = (hex: string) => hex.toUpperCase();

const TOKEN_NAMES: Record<keyof BrandTokens, string> = {
  brand: "--brand",
  brandForeground: "--brand-foreground",
  brandSoft: "--brand-soft",
  brandSoftForeground: "--brand-soft-foreground",
};

function printPalette(palette: Palette) {
  console.log(`${"Brand colors".padEnd(26)}light      dark`);
  for (const key of Object.keys(TOKEN_NAMES) as (keyof BrandTokens)[]) {
    console.log(
      `  ${TOKEN_NAMES[key].padEnd(24)}${palette.light[key]}    ${palette.dark[key]}`,
    );
  }
}

const ratio = (value: number) =>
  `${(Math.floor(value * 100) / 100).toFixed(2)}:1`;

/** Whether every pair passes; if not, what fails and what to change. */
function reportContrast(
  palette: Palette,
  brandColor: string,
  pinned: boolean,
): boolean {
  const checks = contrastChecks(palette);
  const failures = failing(palette);
  if (failures.length === 0) {
    const closest = checks.reduce((a, b) =>
      b.ratio / b.needs < a.ratio / a.needs ? b : a,
    );
    console.log(
      `Contrast (WCAG 2.2 AA): all ${checks.length} pairs pass. The closest: ${closest.use} in the ${closest.theme} theme, ${ratio(closest.ratio)} (${closest.needs}:1 needed).`,
    );
    return true;
  }
  console.error(
    "\nThese brand colors don't have enough contrast (WCAG 2.2 AA):",
  );
  for (const check of failures) {
    console.error(
      `  ✗ ${check.theme} theme, ${check.use}: ${check.foreground} on ${check.background} (${check.against}) is ${ratio(check.ratio)}; it needs ${check.needs}:1.`,
    );
  }
  const brandFails = failures.some(
    (check: Check) =>
      check.theme === "light" &&
      (check.token === "brand" || check.token === "brandForeground"),
  );
  if (brandFails) {
    const better = suggestBrand(brandColor);
    console.error(
      better
        ? `\nThe brand color has to carry text on white. Try a darker shade: ${better} is the nearest one that passes.`
        : "\nThe brand color has to carry text on white: try a darker one.",
    );
  } else if (pinned) {
    console.error(
      '\nChange the values under "colors" in brand/brand.json, or remove them so pnpm brand works them out.',
    );
  } else {
    console.error(
      "\nTry a brand color with a little more contrast against white.",
    );
  }
  return false;
}

/** A logo file: the drawing on a square with the standard 1/16 margin, and its name. */
function markFile(
  name: string,
  mark: Mark,
  square: Mark["viewBox"],
  extra = "",
) {
  return `${svgDocument(
    `<title id="title">${escapeXml(name)}</title>${mark.inner}`,
    square,
    { width: square.width, height: square.height },
    ` role="img" aria-labelledby="title"${extra}`,
  )}\n`;
}

async function formatted(file: string, code: string) {
  const options = await prettier.resolveConfig(file);
  return prettier.format(code, { ...options, filepath: file });
}

async function main(args: string[]) {
  const tryAt = args.indexOf("--try");
  if (tryAt >= 0) {
    const color = args[tryAt + 1] ?? "";
    const palette = derivePalette(color);
    printPalette(palette);
    if (!reportContrast(palette, color, false)) process.exitCode = 1;
    return;
  }

  const configFile = resolve(
    ROOT,
    args.find((arg) => !arg.startsWith("--")) ?? "brand/brand.json",
  );
  const config = readConfig(configFile);
  const palette = derivePalette(config.color, config.colors);
  printPalette(palette);
  const pinned = Object.keys(config.colors).length > 0;
  if (!reportContrast(palette, config.color, pinned)) {
    process.exitCode = 1;
    return;
  }

  // The mark, where its ink is, and its square canvas with a 1/16 margin.
  const at = (file: string) => relative(ROOT, file);
  const mark = readMark(readFileSync(config.mark, "utf8"), at(config.mark));
  const ink = await measureInk(mark);
  const square = squareAround(ink.box, 14 / 16);
  const markDark: Mark = config.markDark
    ? readMark(readFileSync(config.markDark, "utf8"), at(config.markDark))
    : {
        ...mark,
        inner: recolor(mark.inner, config.color, paint(palette.dark.brand)),
      };
  if (
    config.markDark &&
    JSON.stringify(markDark.viewBox) !== JSON.stringify(mark.viewBox)
  ) {
    throw new Error(
      `${at(config.markDark)} needs the same viewBox as ${at(config.mark)}.`,
    );
  }
  if (
    paints(mark.inner).some((color) =>
      ["#fff", "#ffffff", "white"].includes(color),
    )
  ) {
    console.warn(
      "Note: the mark paints white. On a white page those parts disappear, and the one-color versions fill them in: draw holes as holes instead.",
    );
  }

  // The name beside the mark: capitals 17/28 of the mark's height, 5/28 away from it.
  const { wordmark } = config;
  const face = {
    font: loadFont(wordmark.font),
    blendWith: wordmark.blendWith ? loadFont(wordmark.blendWith) : undefined,
    blend: wordmark.blend,
  };
  const word = layoutWord(face, config.name, wordmark);
  const fontCap = capHeightOf(face.font);
  const capHeight = config.lockup.capHeight ?? (ink.box.height * 17) / 28;
  const gap = config.lockup.gap ?? (ink.box.height * 5) / 28;
  const middle = config.lockup.middle ?? ink.box.y + ink.box.height / 2;
  const s = capHeight / fontCap;
  const baseline = middle + 0.5 * (fontCap * s);
  const split = [...config.name].length - [...(wordmark.accent ?? "")].length;
  const words = wordPaths(
    word,
    s,
    ink.box.x + ink.box.width + gap,
    baseline,
    split,
  );
  const box = {
    x: ink.box.x,
    y: Math.min(ink.box.y, words.top),
    width: Math.max(ink.box.x + ink.box.width, words.right) - ink.box.x,
    height:
      Math.max(ink.box.y + ink.box.height, words.bottom) -
      Math.min(ink.box.y, words.top),
  };
  const lockupSize = {
    width: Math.ceil(box.width),
    height: Math.ceil(box.height),
  };
  const wordmarkPaths = (colors: { main: string; accent: string } | null) => {
    const fill = (color: string) => (colors ? ` fill="${color}"` : "");
    const accent = words.accent
      ? `<path${fill(colors?.accent ?? "")} d="${words.accent}"/>`
      : "";
    return `<path${fill(colors?.main ?? "")} d="${words.main}"/>${accent}`;
  };
  const lockup = (
    symbol: string,
    colors: { main: string; accent: string } | null,
  ) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lockupSize.width} ${lockupSize.height}" width="${lockupSize.width}" height="${lockupSize.height}" role="img" aria-labelledby="title"${colors ? "" : ' fill="currentColor"'}>` +
    `<title id="title">${escapeXml(config.name)}</title><g transform="translate(${num(-box.x)} ${num(-box.y)})">` +
    `<g id="symbol">${symbol}</g><g id="wordmark">${wordmarkPaths(colors)}</g></g></svg>\n`;
  const lightColors = {
    main: paint(wordmark.ink),
    accent: paint(palette.light.brand),
  };

  // The favicon switches to the dark theme's brand color when the browser is dark.
  const favicon =
    svgDocument(
      `<title>${escapeXml(config.name)}</title>` +
        (paints(mark.inner).includes(config.color)
          ? `<style>@media (prefers-color-scheme: dark){.brand{fill:${paint(palette.dark.brand)}}}</style>${classify(mark.inner, config.color, "brand")}`
          : mark.inner),
      square,
      { width: square.width, height: square.height },
    ) + "\n";

  // Icons cropped to a circle (Android's maskable) keep the ink inside 40% of the side.
  const maskable = Math.min(
    0.58,
    (0.4 * Math.max(ink.box.width, ink.box.height)) / ink.reach,
  );
  if (maskable < 0.58) {
    console.log(
      `The mark reaches far from its center, so the maskable icon draws it at ${Math.round(maskable * 100)}% to stay inside the safe circle.`,
    );
  }
  const icon = (size: number, fraction: number, background?: string) =>
    renderPng(iconSvg(mark, ink.box, size, fraction, background));

  // The link preview: the lockup, the title and subtitle, and any art below them.
  const W = 1200;
  const H = 630;
  const { preview } = config;
  const art = preview.art
    ? readMark(readFileSync(preview.art, "utf8"), at(preview.art))
    : null;
  const lines = { lockup: 66, title: 262, subtitle: 314 };
  if (!art) {
    const bottom = (preview.subtitle ? lines.subtitle : lines.title) + 10;
    const shift = Math.round((H - (bottom - lines.lockup)) / 2 - lines.lockup);
    lines.lockup += shift;
    lines.title += shift;
    lines.subtitle += shift;
  }
  const lockupScale = 112 / box.height;
  const titleFont = loadFont(PREVIEW_FONTS.title);
  const subtitleFont = loadFont(PREVIEW_FONTS.subtitle);
  const previewSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${paint(SURFACES.light.background)}"/>` +
    `<g transform="translate(${num((W - box.width * lockupScale) / 2)} ${num(lines.lockup)}) scale(${Math.round(lockupScale * 1e6) / 1e6}) translate(${-box.x} ${-box.y})">${mark.inner}${wordmarkPaths(lightColors)}</g>` +
    `<path fill="${paint(SURFACES.light.foreground)}" d="${textLine(titleFont, preview.title, { size: 54, center: W / 2, baseline: lines.title, letterSpacing: -0.5 })}"/>` +
    (preview.subtitle
      ? `<path fill="${paint(SURFACES.light.mutedForeground)}" d="${textLine(subtitleFont, preview.subtitle, { size: 28, center: W / 2, baseline: lines.subtitle })}"/>`
      : "") +
    (art
      ? `<svg x="0" y="0" width="${W}" height="${H}" viewBox="${formatBox(art.viewBox)}">${art.inner}</svg>`
      : "") +
    "</svg>";

  // The Google Workspace add-on's Marketplace card banner: the lockup on the page's color.
  const BANNER = { width: 220, height: 140 };
  const bannerScale =
    Math.round(
      Math.min(
        (BANNER.width * 0.78) / box.width,
        (BANNER.height * 0.36) / box.height,
      ) * 1e6,
    ) / 1e6;
  const bannerSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER.width}" height="${BANNER.height}" viewBox="0 0 ${BANNER.width} ${BANNER.height}">` +
    `<rect width="${BANNER.width}" height="${BANNER.height}" fill="${paint(SURFACES.light.background)}"/>` +
    `<g transform="translate(${num((BANNER.width - box.width * bannerScale) / 2)} ${num((BANNER.height - box.height * bannerScale) / 2)}) scale(${bannerScale}) translate(${-box.x} ${-box.y})">${mark.inner}${wordmarkPaths(lightColors)}</g>` +
    "</svg>";

  // The emails' logo: the lockup on a tile of the card's white, as a PNG at twice its size
  // (mail apps drop SVG). On the email's white card the tile doesn't show. Where a mail
  // app darkens the card in its dark mode it leaves images alone, so the tile keeps the
  // name's dark letters readable there.
  const EMAIL_LOGO_HEIGHT = 32;
  const EMAIL_LOGO_PADDING = 8;
  const emailLogoScale =
    Math.round((EMAIL_LOGO_HEIGHT / box.height) * 1e6) / 1e6;
  const emailLogoSize = {
    width: Math.ceil(box.width * emailLogoScale) + 2 * EMAIL_LOGO_PADDING,
    height: EMAIL_LOGO_HEIGHT + 2 * EMAIL_LOGO_PADDING,
  };
  const emailLogoSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${emailLogoSize.width * 2}" height="${emailLogoSize.height * 2}" viewBox="0 0 ${emailLogoSize.width} ${emailLogoSize.height}">` +
    `<rect width="${emailLogoSize.width}" height="${emailLogoSize.height}" rx="10" fill="${paint(SURFACES.light.card)}"/>` +
    `<g transform="translate(${EMAIL_LOGO_PADDING} ${EMAIL_LOGO_PADDING}) scale(${emailLogoScale}) translate(${-box.x} ${-box.y})">${mark.inner}${wordmarkPaths(lightColors)}</g>` +
    "</svg>";

  const css = `/*
 * The brand's colors, written by \`pnpm brand\` from brand/brand.json: change that and run
 * it again rather than editing this file. src/app/globals.css gives them their roles.
 */
${THEMES.map(
  (theme) =>
    `${theme === "light" ? ":root" : ".dark"} {\n${(
      Object.keys(TOKEN_NAMES) as (keyof BrandTokens)[]
    )
      .map((key) => `  ${TOKEN_NAMES[key]}: ${palette[theme][key]};`)
      .join("\n")}\n}`,
).join("\n\n")}
`;
  const ts = `// Written by \`pnpm brand\` from brand/brand.json: change that and run it again rather
// than editing this file.

/** The brand's colors, for what CSS can't reach: emails and the offline page. */
export const BRAND_COLORS = ${JSON.stringify(palette)} as const;

/** The logo with the name beside it (public/brand/logo-lockup*.svg), in pixels. */
export const LOCKUP_SIZE = ${JSON.stringify(lockupSize)} as const;

/** The emails' logo (public/brand/logo-email.png, drawn at twice this), in CSS pixels. */
export const EMAIL_LOGO_SIZE = ${JSON.stringify(emailLogoSize)} as const;
`;

  /** Every file the app ships that comes from the brand. */
  const OUTPUTS: [string, () => Promise<string | Buffer> | string | Buffer][] =
    [
      ["public/brand/logo-mark.svg", () => markFile(config.name, mark, square)],
      [
        "public/brand/logo-mark-dark.svg",
        () => markFile(config.name, markDark, square),
      ],
      [
        "public/brand/logo-mono.svg",
        () =>
          markFile(
            config.name,
            { ...mark, inner: oneColor(mark.inner) },
            square,
            ' fill="currentColor"',
          ),
      ],
      ["public/brand/logo-lockup.svg", () => lockup(mark.inner, lightColors)],
      ["public/brand/logo-email.png", () => renderPng(emailLogoSvg)],
      [
        "public/brand/logo-lockup-dark.svg",
        () =>
          lockup(markDark.inner, {
            main: paint(wordmark.inkOnDark),
            accent: paint(palette.dark.brand),
          }),
      ],
      [
        "public/brand/logo-lockup-mono.svg",
        () => lockup(oneColor(mark.inner), null),
      ],
      ["public/icons/icon-192.png", () => icon(192, 14 / 16)],
      ["public/icons/icon-512.png", () => icon(512, 14 / 16)],
      [
        "public/icons/icon-maskable-512.png",
        () => icon(512, maskable, paint(config.iconBackground)),
      ],
      ["src/app/icon.svg", () => favicon],
      [
        "src/app/favicon.ico",
        async () =>
          ico(
            await Promise.all([16, 32, 48].map((size) => icon(size, 14 / 16))),
          ),
      ],
      [
        "src/app/apple-icon.png",
        () => icon(180, 0.64, paint(config.iconBackground)),
      ],
      ["src/app/opengraph-image.png", () => renderPng(previewSvg)],
      // The Google Workspace add-on's Marketplace listing (DEPLOY.md). Google Calendar
      // shows the 32 px icon as the conference logo, from the address the listing gives it.
      ["google-addon/assets/icon-32.png", () => icon(32, 14 / 16)],
      ["google-addon/assets/icon-128.png", () => icon(128, 14 / 16)],
      ["google-addon/assets/banner-220x140.png", () => renderPng(bannerSvg)],
      [
        "src/app/brand.css",
        () => formatted(resolve(ROOT, "src/app/brand.css"), css),
      ],
      [
        "src/lib/brand.ts",
        () => formatted(resolve(ROOT, "src/lib/brand.ts"), ts),
      ],
    ];

  const changed: string[] = [];
  for (const [path, make] of OUTPUTS) {
    const file = resolve(ROOT, path);
    const content = await make();
    const bytes = typeof content === "string" ? Buffer.from(content) : content;
    let before: Buffer | null = null;
    try {
      before = readFileSync(file);
    } catch {
      // A new file.
    }
    if (before && before.equals(bytes)) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    changed.push(path);
  }
  console.log(
    changed.length === 0
      ? `\nEverything was already up to date (${OUTPUTS.length} files).`
      : `\nWrote ${changed.length} of ${OUTPUTS.length} files:\n${changed.map((path) => `  ${path}`).join("\n")}`,
  );
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
