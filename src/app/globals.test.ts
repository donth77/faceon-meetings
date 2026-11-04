import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Japanese type in globals.css: the fonts it falls back to, and headings' letter-spacing.
const css = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

/** The declarations of the first rule with exactly this selector, or "". */
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
}

const japanese = rule(":root:lang(ja)");
const japaneseFonts = (japanese.match(/--font-language:([^;]+);/)?.[1] ?? "")
  .split(",")
  .map((font) => font.trim().replace(/^"|"$/g, ""));

/** Every source file under src that can hold class names. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

describe("Japanese type", () => {
  it("never uses Yu Gothic UI, whose narrow kana squeeze running text", () => {
    expect(japanese).not.toBe("");
    expect(japaneseFonts).not.toContain("Yu Gothic UI");
    expect(css).not.toMatch(/local\("Yu Gothic UI/);
  });

  it("uses Hiragino on Apple's systems, readable Yu Gothic on Windows, then Noto", () => {
    expect(japaneseFonts.slice(0, 4)).toEqual([
      "Hiragino Sans",
      "Hiragino Kaku Gothic ProN",
      "Yu Gothic Readable",
      "Yu Gothic",
    ]);
    expect(japaneseFonts).toContain("Noto Sans JP");
  });

  it("draws Yu Gothic's normal weights with its Medium and bold with its Bold", () => {
    const faces = [...css.matchAll(/@font-face\s*{([^}]+)}/g)].map(
      ([, body]) => body ?? "",
    );
    const readable = faces.filter((body) =>
      body.includes('font-family: "Yu Gothic Readable"'),
    );
    expect(readable).toHaveLength(2);
    const [normal, bold] = readable;
    expect(normal).toContain('local("Yu Gothic Medium")');
    expect(normal).toContain("font-weight: 100 500;");
    expect(bold).toContain('local("Yu Gothic Bold")');
    expect(bold).toContain("font-weight: 600 900;");
    // Only fonts already on the computer: nothing to download.
    for (const body of readable) expect(body).not.toMatch(/url\(/);
  });

  it("resets every negative letter-spacing token to 0", () => {
    // Tailwind's own, and every one the theme defines.
    const negative = new Set(["--tracking-tighter", "--tracking-tight"]);
    for (const [, name] of css.matchAll(/(--tracking-[a-z-]+):\s*-/g)) {
      if (name) negative.add(name);
    }
    expect(negative.size).toBeGreaterThan(2);
    for (const name of negative) expect(japanese).toContain(`${name}: 0em;`);
  });

  it("gives headings their letter-spacing by token, which Japanese can reset", () => {
    // A bracketed negative value (tracking-[…]) would ignore the reset above.
    const offenders = sources(path.join(process.cwd(), "src")).filter((file) =>
      /tracking-\[-/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
