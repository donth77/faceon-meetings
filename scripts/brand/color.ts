/**
 * Color maths for `pnpm brand`: sRGB hex colors to and from OKLCH (Björn Ottosson's
 * OKLab in polar form, as CSS uses it), fitting a color into sRGB, and WCAG 2 contrast.
 * OKLCH keeps a hue looking the same while its lightness changes, which is what deriving
 * the lighter and darker brand colors needs.
 */

/** sRGB channels from 0 to 1, gamma-encoded as in a hex color. */
export type Rgb = { r: number; g: number; b: number };

/** Lightness from 0 to 1, chroma from 0 (grey), hue in degrees. */
export type Oklch = { l: number; c: number; h: number };

const HEX = /^#?([0-9a-f]{6})$/i;

export function isHex(value: string): boolean {
  return HEX.test(value);
}

export function parseHex(hex: string): Rgb {
  const match = HEX.exec(hex);
  if (!match?.[1]) throw new Error(`"${hex}" isn't a color like #1f5eff.`);
  const n = Number.parseInt(match[1], 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

/** Lowercase #rrggbb, rounded to the nearest 8-bit color. */
export function toHex({ r, g, b }: Rgb): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const toLinear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const toGamma = (v: number) =>
  v <= 0.0031308
    ? 12.92 * v
    : 1.055 * Math.sign(v) * Math.abs(v) ** (1 / 2.4) - 0.055;

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  const h = c < 1e-6 ? 0 : (Math.atan2(bb, a) * 180) / Math.PI;
  return { l: L, c, h: h < 0 ? h + 360 : h };
}

/** May fall outside sRGB (a channel below 0 or above 1): see `fitToSrgb`. */
export function oklchToRgb({ l: L, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const inSrgb = ({ r, g, b }: Rgb) =>
  [r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/**
 * The color at this lightness and hue with as much of the chroma as sRGB can show:
 * lightening a saturated blue, say, has to give up some of its chroma.
 */
export function fitToSrgb(color: Oklch): string {
  const l = Math.min(1, Math.max(0, color.l));
  if (inSrgb(oklchToRgb({ ...color, l })))
    return toHex(oklchToRgb({ ...color, l }));
  let low = 0;
  let high = color.c;
  for (let i = 0; i < 24; i++) {
    const c = (low + high) / 2;
    if (inSrgb(oklchToRgb({ l, c, h: color.h }))) low = c;
    else high = c;
  }
  return toHex(oklchToRgb({ l, c: low, h: color.h }));
}

export const toOklch = (hex: string): Oklch => rgbToOklch(parseHex(hex));

/** WCAG 2 relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2 contrast ratio, from 1 (none) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** How different two colors look (OKLab distance; under about 0.02 is hard to see). */
export function difference(a: string, b: string): number {
  const [x, y] = [toOklch(a), toOklch(b)];
  const ab = (o: Oklch) => [
    o.c * Math.cos((o.h * Math.PI) / 180),
    o.c * Math.sin((o.h * Math.PI) / 180),
  ];
  const [xa, xb] = ab(x) as [number, number];
  const [ya, yb] = ab(y) as [number, number];
  return Math.hypot(x.l - y.l, xa - ya, xb - yb);
}
