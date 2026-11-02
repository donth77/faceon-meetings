// The parts of opentype.js (1.3) that `pnpm brand` uses; the package ships no types.
declare module "opentype.js" {
  export type PathCommand =
    | { type: "M" | "L"; x: number; y: number }
    | { type: "Q"; x1: number; y1: number; x: number; y: number }
    | {
        type: "C";
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x: number;
        y: number;
      }
    | { type: "Z" };

  export interface Path {
    commands: PathCommand[];
    toPathData(decimalPlaces?: number): string;
  }

  export interface Glyph {
    index: number;
    advanceWidth: number;
    /** In font units, y up. */
    path: Path;
  }

  export interface RenderOptions {
    kerning?: boolean;
    /** In ems, after each letter. */
    letterSpacing?: number;
  }

  export interface Font {
    unitsPerEm: number;
    tables: { os2?: { sCapHeight?: number } };
    charToGlyph(char: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
    getPath(
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: RenderOptions,
    ): Path;
    getAdvanceWidth(
      text: string,
      fontSize: number,
      options?: RenderOptions,
    ): number;
  }

  export function parse(buffer: ArrayBuffer): Font;

  const opentype: { parse: typeof parse };
  export default opentype;
}
