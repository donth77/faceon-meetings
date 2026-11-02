/**
 * The mark as `pnpm brand` reads it: the drawing inside its root <svg>, and the versions
 * made from it (on a square canvas, recolored for dark backgrounds, in one color). The
 * drawing itself is kept as written, so a mark comes out exactly as it went in.
 */

export type Box = { x: number; y: number; width: number; height: number };

export type Mark = {
  /** The drawing inside the root <svg>, without <title>, <desc> or <metadata>. */
  inner: string;
  /** The mark's own coordinates. */
  viewBox: Box;
};

/** Numbers as SVG writes them: at most two decimals, no trailing zeros. */
export const num = (value: number) => String(Math.round(value * 100) / 100);

export const formatBox = (box: Box) =>
  [box.x, box.y, box.width, box.height].map(num).join(" ");

/** Fill and stroke settings on the root apply to the whole drawing, so they come along. */
const INHERITED =
  /\s((?:fill|stroke|color|opacity|style)[\w-]*)=("[^"]*"|'[^']*')/g;

export function readMark(svg: string, file: string): Mark {
  const open = /<svg\b([^>]*)>/i.exec(svg);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < open.index || open[0].endsWith("/>")) {
    throw new Error(`${file} isn't an SVG with a drawing in it.`);
  }
  const attributes = open[1] ?? "";
  const attribute = (name: string) =>
    new RegExp(`\\s${name}=["']([^"']*)["']`, "i").exec(attributes)?.[1];
  const numbers = attribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const length = (name: string) => Number.parseFloat(attribute(name) ?? "");
  const viewBox: Box | null =
    numbers?.length === 4 && numbers.every(Number.isFinite)
      ? {
          x: numbers[0] ?? 0,
          y: numbers[1] ?? 0,
          width: numbers[2] ?? 0,
          height: numbers[3] ?? 0,
        }
      : Number.isFinite(length("width")) && Number.isFinite(length("height"))
        ? { x: 0, y: 0, width: length("width"), height: length("height") }
        : null;
  if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) {
    throw new Error(`${file} needs a viewBox (or a width and height).`);
  }
  let inner = svg
    .slice(open.index + open[0].length, close)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(title|desc|metadata)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/>\s+</g, "><")
    .trim();
  const inherited = [...attributes.matchAll(INHERITED)]
    .map(([whole]) => whole)
    .join("");
  if (inherited) inner = `<g${inherited}>${inner}</g>`;
  if (/<text\b/i.test(inner)) {
    throw new Error(
      `${file} has text in it. Convert the text to outlines (shapes) in your design tool, so it looks the same everywhere.`,
    );
  }
  return { inner, viewBox };
}

/** A square around `box` with the drawing filling `fraction` of it, centered. */
export function squareAround(box: Box, fraction: number): Box {
  const side = Math.max(box.width, box.height) / fraction;
  return {
    x: box.x + box.width / 2 - side / 2,
    y: box.y + box.height / 2 - side / 2,
    width: side,
    height: side,
  };
}

/** An <svg> of the drawing, `size` pixels across. */
export function svgDocument(
  inner: string,
  viewBox: Box,
  size: { width: number; height: number },
  extra = "",
): string {
  const xlink = inner.includes("xlink:")
    ? ' xmlns:xlink="http://www.w3.org/1999/xlink"'
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${xlink} viewBox="${formatBox(viewBox)}" width="${num(size.width)}" height="${num(size.height)}"${extra}>${inner}</svg>`;
}

const PAINT =
  /(\s(fill|stroke)=)(["'])([^"']*)\3|((?:^|[{;"'\s])(fill|stroke)\s*:\s*)([^;}"']+)/gi;

/** Every fill and stroke color the drawing uses, lowercased. */
export function paints(inner: string): string[] {
  return [...inner.matchAll(PAINT)].map((match) =>
    (match[4] ?? match[7] ?? "").trim().toLowerCase(),
  );
}

/** Each fill or stroke in `from` (any case) becomes `to`. */
export function recolor(inner: string, from: string, to: string): string {
  const target = from.toLowerCase();
  return inner.replace(
    PAINT,
    (whole, attr, _name, quote, value, prop, _prop, styleValue) => {
      const current = (value ?? styleValue ?? "").trim().toLowerCase();
      if (current !== target) return whole;
      return attr ? `${attr}${quote}${to}${quote}` : `${prop}${to}`;
    },
  );
}

/**
 * The drawing in one color, the one around it (CSS `color`): fills are dropped so the
 * root's `fill="currentColor"` applies, and strokes take `currentColor`.
 */
export function oneColor(inner: string): string {
  return inner
    .replace(/\sfill=(["'])(?!none\1)[^"']*\1/gi, "")
    .replace(/(\sstroke=)(["'])(?!none\2)[^"']*\2/gi, "$1$2currentColor$2")
    .replace(
      /((?:^|[{;"'\s])(?:fill|stroke)\s*:\s*)(?!none)[^;}"']+/gi,
      "$1currentColor",
    );
}

/** Marks every shape filled with `color` with a class, for a stylesheet to restyle. */
export function classify(
  inner: string,
  color: string,
  className: string,
): string {
  const target = color.toLowerCase();
  return inner.replace(
    /<(\w+)\b([^>]*)>/g,
    (whole, tag: string, rest: string) => {
      const fill = /\sfill=["']([^"']*)["']/i.exec(rest)?.[1]?.toLowerCase();
      if (fill !== target) return whole;
      return /\sclass=["']/.test(rest)
        ? whole.replace(/(\sclass=["'])/, `$1${className} `)
        : `<${tag} class="${className}"${rest}>`;
    },
  );
}

export const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
