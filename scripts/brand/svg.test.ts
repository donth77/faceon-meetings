import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  classify,
  oneColor,
  paints,
  readMark,
  recolor,
  squareAround,
} from "./svg.ts";

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/** The drawing inside a logo file, after its <title>. */
const drawing = (svg: string) =>
  svg.slice(
    svg.indexOf("</title>") + "</title>".length,
    svg.lastIndexOf("</svg>"),
  );

describe("reading a mark", () => {
  it("keeps FaceOn's drawing exactly as written", () => {
    const mark = readMark(read("brand/mark.svg"), "mark.svg");
    expect(mark.viewBox).toEqual({ x: 0, y: 0, width: 256, height: 256 });
    expect(mark.inner).toBe(drawing(read("public/brand/logo-mark.svg")));
  });

  it("drops titles, comments and the whitespace between tags", () => {
    const mark = readMark(
      `<?xml version="1.0"?>\n<svg viewBox="0 0 10 10">\n  <title>Old</title>\n  <!-- a note -->\n  <rect width="10" height="10"/>\n</svg>`,
      "x.svg",
    );
    expect(mark.inner).toBe('<rect width="10" height="10"/>');
  });

  it("keeps what the root sets for the whole drawing", () => {
    const mark = readMark(
      '<svg width="24" height="24" fill="none" stroke="#0f766e"><path d="M1 1"/></svg>',
      "x.svg",
    );
    expect(mark.viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(mark.inner).toBe(
      '<g fill="none" stroke="#0f766e"><path d="M1 1"/></g>',
    );
  });

  it("asks for outlines instead of text, and for a size", () => {
    expect(() =>
      readMark('<svg viewBox="0 0 9 9"><text>Hi</text></svg>', "x.svg"),
    ).toThrow(/outlines/);
    expect(() => readMark('<svg><path d="M1 1"/></svg>', "x.svg")).toThrow(
      /viewBox/,
    );
  });
});

describe("the mark's versions", () => {
  const mark = readMark(read("brand/mark.svg"), "mark.svg");

  it("in one color, as FaceOn's own", () => {
    expect(oneColor(mark.inner)).toBe(
      drawing(read("public/brand/logo-mono.svg")),
    );
    expect(oneColor('<path style="fill:#123456;stroke:none" d="M1 1"/>')).toBe(
      '<path style="fill:currentColor;stroke:none" d="M1 1"/>',
    );
  });

  it("recolors only the brand color, whatever its case", () => {
    const dark = recolor(mark.inner, "#1f5eff", "#4D7EFF");
    expect(paints(dark)).toEqual(["#4d7eff", "#1db46b"]);
  });

  it("marks the brand-colored shapes for the favicon's dark style", () => {
    const marked = classify(mark.inner, "#1f5eff", "brand");
    expect(marked.match(/class="brand"/g)).toHaveLength(1);
    expect(marked).toContain('<path class="brand" fill="#1F5EFF"');
  });

  it("sits on a square with a 1/16 margin", () => {
    expect(
      squareAround({ x: 16, y: 16, width: 224, height: 224 }, 14 / 16),
    ).toEqual({ x: 0, y: 0, width: 256, height: 256 });
    const wide = squareAround({ x: 0, y: 0, width: 140, height: 70 }, 14 / 16);
    expect(wide).toEqual({ x: -10, y: -45, width: 160, height: 160 });
  });
});
