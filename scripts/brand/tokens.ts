/**
 * The colors that come from the brand, worked out from one color, and the contrast they
 * need against the surfaces and text they're used with (WCAG 2.2 AA). The app maps them
 * onto its own tokens in src/app/globals.css (`--primary: var(--brand)` and so on).
 */
import { contrast, fitToSrgb, isHex, toOklch } from "./color.ts";

export type Theme = "light" | "dark";
export const THEMES = ["light", "dark"] as const satisfies readonly Theme[];

export type BrandTokens = {
  /** Buttons, links, brand-colored text and icons, focus rings, what's selected. */
  brand: string;
  /** Labels on the brand color: white, or a near-black when the brand is light. */
  brandForeground: string;
  /** A soft tint for chips, the current item and hovered rows. */
  brandSoft: string;
  /** Brand-colored text on the tint (and on cards beside it). */
  brandSoftForeground: string;
};
export type Palette = Record<Theme, BrandTokens>;
/** Values to use as given instead of working them out (the light brand is the color). */
export type PinnedTokens = {
  light?: Partial<Omit<BrandTokens, "brand">>;
  dark?: Partial<BrandTokens>;
};

/**
 * The neutrals the brand colors sit on, as src/app/globals.css defines them (a unit test
 * keeps the two in step). A copy's brand changes these only if globals.css does.
 */
export const SURFACES = {
  light: {
    background: "#f5f6f8",
    card: "#ffffff",
    sidebar: "#ffffff",
    muted: "#eef0f3",
    foreground: "#12161c",
    mutedForeground: "#4f5966",
  },
  dark: {
    background: "#0e1116",
    card: "#161a21",
    sidebar: "#12161c",
    muted: "#1d222b",
    foreground: "#eef1f5",
    mutedForeground: "#a3acb9",
  },
} as const satisfies Record<Theme, Record<string, string>>;

/** Text (WCAG 1.4.3) and icons, outlines and focus rings (1.4.11, 2.4.13). */
const TEXT = 4.5;
const NON_TEXT = 3;

export type Check = {
  theme: Theme;
  /** What the pair is used for, in words. */
  use: string;
  /** The brand token that's checked, and what it's against. */
  token: keyof BrandTokens;
  against: string;
  foreground: string;
  background: string;
  ratio: number;
  needs: number;
};

/** Every pair the app uses a brand color in, with its contrast. */
export function contrastChecks(palette: Palette): Check[] {
  return THEMES.flatMap((theme) => {
    const t = palette[theme];
    const s = SURFACES[theme];
    const pair = (
      use: string,
      token: keyof BrandTokens,
      foreground: string,
      against: string,
      background: string,
      needs: number,
    ): Check => ({
      theme,
      use,
      token,
      against,
      foreground,
      background,
      ratio: contrast(foreground, background),
      needs,
    });
    return [
      pair(
        "button labels",
        "brandForeground",
        t.brandForeground,
        "brand",
        t.brand,
        TEXT,
      ),
      pair(
        "brand-colored text on the page",
        "brand",
        t.brand,
        "page",
        s.background,
        TEXT,
      ),
      pair(
        "brand-colored text on cards and menus",
        "brand",
        t.brand,
        "card",
        s.card,
        TEXT,
      ),
      pair(
        "brand-colored text in the sidebar",
        "brand",
        t.brand,
        "sidebar",
        s.sidebar,
        TEXT,
      ),
      pair(
        "focus rings beside grey fills",
        "brand",
        t.brand,
        "grey fill",
        s.muted,
        NON_TEXT,
      ),
      pair(
        "brand-colored icons on the tint",
        "brand",
        t.brand,
        "tint",
        t.brandSoft,
        NON_TEXT,
      ),
      pair(
        "brand-colored text on the tint",
        "brandSoftForeground",
        t.brandSoftForeground,
        "tint",
        t.brandSoft,
        TEXT,
      ),
      pair(
        "the tint's text color on cards",
        "brandSoftForeground",
        t.brandSoftForeground,
        "card",
        s.card,
        TEXT,
      ),
      pair(
        "text on the tint",
        "brandSoft",
        s.foreground,
        "tint",
        t.brandSoft,
        TEXT,
      ),
    ];
  });
}

export const failing = (palette: Palette) =>
  contrastChecks(palette).filter((check) => check.ratio < check.needs);

/**
 * Starting from `color`, the first shade going lighter or darker that `ok` accepts; null
 * when none does. The hue stays. Going darker, the chroma falls with the lightness, so a
 * darker shade doesn't glow; going lighter, it keeps as much as sRGB can show.
 */
export function shade(
  color: string,
  direction: "lighter" | "darker",
  ok: (hex: string) => boolean,
): string | null {
  const { l, c, h } = toOklch(color);
  const step = direction === "lighter" ? 0.002 : -0.002;
  for (let lightness = l; lightness >= 0 && lightness <= 1; lightness += step) {
    const chroma = direction === "darker" && l > 0 ? (c * lightness) / l : c;
    const candidate = fitToSrgb({ l: lightness, c: chroma, h });
    if (ok(candidate)) return candidate;
  }
  return null;
}

/** A color at a fixed lightness in the brand's hue, its chroma scaled and capped. */
function tint(color: string, lightness: number, share: number, cap: number) {
  const { c, h } = toOklch(color);
  return fitToSrgb({ l: lightness, c: Math.min(c * share, cap), h });
}

const passes = (ratio: number, needs: number) => ratio >= needs;

/**
 * The light and dark brand tokens for one brand color. The light theme uses the color
 * itself; the rest are worked out from it with a little room above each minimum, and any
 * value in `pinned` is used as given. Run `failing()` on the result: a brand color that
 * can't carry text on white fails there.
 */
export function derivePalette(
  color: string,
  pinned: PinnedTokens = {},
): Palette {
  if (!isHex(color)) throw new Error(`"${color}" isn't a color like #1f5eff.`);
  const brand = color.toLowerCase();
  const nearBlack = tint(brand, 0.17, 0.08, 0.02);

  const lightSoft = pinned.light?.brandSoft ?? tint(brand, 0.95, 0.1, 0.035);
  const light: BrandTokens = {
    brand,
    brandForeground:
      pinned.light?.brandForeground ??
      (contrast("#ffffff", brand) >= TEXT ? "#ffffff" : nearBlack),
    brandSoft: lightSoft,
    brandSoftForeground:
      pinned.light?.brandSoftForeground ??
      shade(
        brand,
        "darker",
        (hex) =>
          passes(contrast(hex, lightSoft), 5.5) &&
          passes(contrast(hex, SURFACES.light.card), TEXT),
      ) ??
      SURFACES.light.foreground,
  };

  // On dark surfaces the brand color gets lighter until text in it reads on every one,
  // with a near-black label of its hue.
  const darkForeground = pinned.dark?.brandForeground ?? nearBlack;
  const darkSurfaces = [
    SURFACES.dark.background,
    SURFACES.dark.card,
    SURFACES.dark.sidebar,
  ];
  const darkBrand =
    pinned.dark?.brand ??
    shade(
      brand,
      "lighter",
      (hex) =>
        darkSurfaces.every((surface) => passes(contrast(hex, surface), 4.75)) &&
        passes(contrast(hex, darkForeground), TEXT),
    ) ??
    SURFACES.dark.foreground;
  const darkSoft = pinned.dark?.brandSoft ?? tint(brand, 0.27, 0.22, 0.06);
  const dark: BrandTokens = {
    brand: darkBrand,
    brandForeground: darkForeground,
    brandSoft: darkSoft,
    brandSoftForeground:
      pinned.dark?.brandSoftForeground ??
      shade(
        darkBrand,
        "lighter",
        (hex) =>
          passes(contrast(hex, darkSoft), 5.5) &&
          passes(contrast(hex, SURFACES.dark.card), TEXT),
      ) ??
      SURFACES.dark.foreground,
  };
  return { light, dark };
}

/**
 * When the brand color itself can't carry text on the light theme's page and cards: the
 * nearest darker shade that can, to suggest instead.
 */
export function suggestBrand(color: string): string | null {
  return shade(
    color,
    "darker",
    (hex) => failing(derivePalette(hex)).length === 0,
  );
}
