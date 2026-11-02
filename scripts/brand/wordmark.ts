/**
 * The name, set in the brand font and turned into outlines, so the logo looks the same
 * everywhere without the font. Two point-compatible weights of one design can be blended
 * (FaceOn's 750 is halfway between Bricolage Grotesque's 700 and 800).
 */
import { readFileSync } from "node:fs";
import opentype, { type Font, type PathCommand } from "opentype.js";

export function loadFont(file: string): Font {
  const bytes = readFileSync(file);
  return opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

export type WordmarkFont = {
  font: Font;
  /** A second weight to blend toward, and how far (0 to 1). */
  blendWith?: Font;
  blend: number;
};

export type Spacing = {
  /** Font units after each letter. */
  tracking: number;
  /** Font units between particular letters, keyed by the two letters. */
  pairs: Record<string, number>;
};

type Glyph = { char: string; commands: PathCommand[]; x: number };

export type Word = {
  glyphs: Glyph[];
  /** Where the ink starts and ends, in font units (control points included). */
  inkLeft: number;
  inkRight: number;
  inkTop: number;
  inkBottom: number;
};

const COORDINATES = ["x", "y", "x1", "y1", "x2", "y2"] as const;
type Coordinate = (typeof COORDINATES)[number];

/** A command's point by name; undefined where it has none (Z has none at all). */
const point = (command: PathCommand, key: Coordinate) =>
  (command as Partial<Record<Coordinate, number>>)[key];

function glyphOf({ font, blendWith, blend }: WordmarkFont, char: string) {
  const a = font.charToGlyph(char);
  if (a.index === 0) throw new Error(`The wordmark's font has no "${char}".`);
  if (!blendWith) return { commands: a.path.commands, advance: a.advanceWidth };
  const b = blendWith.charToGlyph(char);
  const from = a.path.commands;
  const to = b.path.commands;
  if (
    from.length !== to.length ||
    from.some((c, i) => c.type !== to[i]?.type)
  ) {
    throw new Error(
      `The two wordmark fonts draw "${char}" differently, so they can't be blended. Use one font.`,
    );
  }
  const lerp = (x: number, y: number) => x + (y - x) * blend;
  const commands = from.map((command, i) => {
    const mixed: Record<string, number | string> = { type: command.type };
    for (const key of COORDINATES) {
      const a = point(command, key);
      const b = to[i] && point(to[i], key);
      if (a !== undefined && b !== undefined) mixed[key] = lerp(a, b);
    }
    return mixed as PathCommand;
  });
  return { commands, advance: lerp(a.advanceWidth, b.advanceWidth) };
}

/** Lays out `text` from x = 0 in font units, with the font's kerning and `spacing`. */
export function layoutWord(
  face: WordmarkFont,
  text: string,
  spacing: Spacing,
): Word {
  const chars = [...text];
  const glyphs: Glyph[] = [];
  let x = 0;
  chars.forEach((char, i) => {
    const { commands, advance } = glyphOf(face, char);
    glyphs.push({ char, commands, x });
    x += advance + spacing.tracking;
    const next = chars[i + 1];
    if (next !== undefined) {
      const kern = (font: Font) =>
        font.getKerningValue(font.charToGlyph(char), font.charToGlyph(next));
      const kerning = face.blendWith
        ? kern(face.font) +
          (kern(face.blendWith) - kern(face.font)) * face.blend
        : kern(face.font);
      x += (spacing.pairs[char + next] ?? 0) + kerning;
    }
  });
  let inkLeft = Infinity;
  let inkRight = -Infinity;
  let inkTop = -Infinity;
  let inkBottom = Infinity;
  for (const glyph of glyphs) {
    for (const command of glyph.commands) {
      for (const [kx, ky] of [
        ["x", "y"],
        ["x1", "y1"],
        ["x2", "y2"],
      ] as const) {
        const px = point(command, kx);
        const py = point(command, ky);
        if (px === undefined || py === undefined) continue;
        inkLeft = Math.min(inkLeft, glyph.x + px);
        inkRight = Math.max(inkRight, glyph.x + px);
        inkTop = Math.max(inkTop, py);
        inkBottom = Math.min(inkBottom, py);
      }
    }
  }
  return { glyphs, inkLeft, inkRight, inkTop, inkBottom };
}

const r2 = (value: number) => Math.round(value * 100) / 100;

/** Font-unit commands as SVG path data, scaled by `s` from `origin` on `baseline` (y down). */
function toPath(
  commands: PathCommand[],
  s: number,
  origin: number,
  baseline: number,
) {
  const X = (x: number) => r2(origin + x * s);
  const Y = (y: number) => r2(baseline - y * s);
  return commands
    .map((c) => {
      switch (c.type) {
        case "M":
        case "L":
          return `${c.type}${X(c.x)} ${Y(c.y)}`;
        case "Q":
          return `Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`;
        case "C":
          return `C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`;
        case "Z":
          return "Z";
      }
    })
    .join("");
}

/**
 * The word as path data, its ink starting at `left` on `baseline`, scaled by `s`: the
 * letters before `split` and those from it (the accent) as two paths.
 */
export function wordPaths(
  word: Word,
  s: number,
  left: number,
  baseline: number,
  split: number,
) {
  const x0 = left - word.inkLeft * s;
  const paths = word.glyphs.map((glyph) =>
    toPath(glyph.commands, s, x0 + glyph.x * s, baseline),
  );
  return {
    main: paths.slice(0, split).join(""),
    accent: paths.slice(split).join(""),
    right: left + (word.inkRight - word.inkLeft) * s,
    top: baseline - word.inkTop * s,
    bottom: baseline - word.inkBottom * s,
  };
}

/** The font's capital height in font units (OS/2), or the height of its "H". */
export function capHeightOf(font: Font): number {
  const declared = font.tables.os2?.sCapHeight;
  if (declared) return declared;
  const h = font.charToGlyph("H").path.commands;
  return Math.max(...h.flatMap((c) => ("y" in c ? [c.y] : [])));
}

/** A line of text as outlines, centered on `center`, for the link preview. */
export function textLine(
  font: Font,
  text: string,
  options: {
    size: number;
    center: number;
    baseline: number;
    letterSpacing?: number;
  },
): string {
  const render = {
    kerning: true,
    letterSpacing: (options.letterSpacing ?? 0) / options.size,
  };
  const width = font.getAdvanceWidth(text, options.size, render);
  return font
    .getPath(
      text,
      options.center - width / 2,
      options.baseline,
      options.size,
      render,
    )
    .toPathData(2);
}
