import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BRAND_COLORS } from "@/lib/brand";

import { contrast, difference, toOklch } from "./color.ts";
import {
  contrastChecks,
  derivePalette,
  failing,
  suggestBrand,
  SURFACES,
  THEMES,
  type BrandTokens,
} from "./tokens.ts";

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const config = JSON.parse(read("brand/brand.json")) as {
  color: string;
  colors: Parameters<typeof derivePalette>[1];
};

/** The custom properties a CSS block declares, by selector. */
function declarations(css: string, selector: string): Record<string, string> {
  const block = new RegExp(
    `(?:^|\\n)${selector.replace(".", "\\.")} \\{([^}]*)\\}`,
  ).exec(css)?.[1];
  if (!block) throw new Error(`No ${selector} block`);
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value?.trim(),
    ]),
  );
}

describe("FaceOn's own brand colors", () => {
  const palette = derivePalette(config.color, config.colors);

  it("pass every contrast check", () => {
    expect(failing(palette)).toEqual([]);
    expect(contrastChecks(palette)).toHaveLength(18);
  });

  it("are what the app uses (brand.css and lib/brand.ts, written by pnpm brand)", () => {
    expect(BRAND_COLORS).toEqual(palette);
    const css = read("src/app/brand.css");
    for (const [theme, selector] of [
      ["light", ":root"],
      ["dark", ".dark"],
    ] as const) {
      expect(declarations(css, selector)).toEqual({
        "--brand": palette[theme].brand,
        "--brand-foreground": palette[theme].brandForeground,
        "--brand-soft": palette[theme].brandSoft,
        "--brand-soft-foreground": palette[theme].brandSoftForeground,
      });
    }
  });

  it("come close to the hand-picked ones when worked out from the one color", () => {
    const derived = derivePalette(config.color);
    for (const theme of THEMES) {
      for (const key of Object.keys(palette[theme]) as (keyof BrandTokens)[]) {
        expect(
          difference(derived[theme][key], palette[theme][key]),
        ).toBeLessThan(0.02);
      }
    }
  });
});

describe("the surfaces the checks use", () => {
  it("match src/app/globals.css", () => {
    const css = read("src/app/globals.css");
    for (const [theme, selector] of [
      ["light", ":root"],
      ["dark", ".dark"],
    ] as const) {
      const tokens = declarations(css, selector);
      const s = SURFACES[theme];
      expect({
        background: tokens["--background"],
        card: tokens["--card"],
        sidebar: tokens["--sidebar"],
        muted: tokens["--muted"],
        foreground: tokens["--foreground"],
        mutedForeground: tokens["--muted-foreground"],
      }).toEqual(s);
    }
  });
});

describe("working out a palette", () => {
  it("passes every check for colors that can carry text on white", () => {
    for (const color of [
      "#0f766e",
      "#7c3aed",
      "#0a1f44",
      "#2563eb",
      "#b42318",
      "#000000",
    ]) {
      const palette = derivePalette(color);
      expect(failing(palette), color).toEqual([]);
      expect(palette.light.brand).toBe(color);
    }
  });

  it("lightens the brand color for dark surfaces and keeps its hue", () => {
    const palette = derivePalette("#0f766e");
    expect(
      contrast(palette.dark.brand, SURFACES.dark.card),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.dark.brand, "#ffffff")).toBeLessThan(
      contrast("#0f766e", "#ffffff"),
    );
  });

  it("uses pinned colors as given", () => {
    const palette = derivePalette("#0f766e", { dark: { brand: "#5eead4" } });
    expect(palette.dark.brand).toBe("#5eead4");
  });

  it("fails a color too light for text on white, and suggests the nearest that works", () => {
    for (const color of ["#facc15", "#16a34a", "#ea580c"]) {
      const failures = failing(derivePalette(color));
      expect(failures.map((check) => check.use)).toContain(
        "brand-colored text on the page",
      );
      const better = suggestBrand(color);
      expect(better).not.toBeNull();
      expect(failing(derivePalette(better ?? ""))).toEqual([]);
      // A darker shade of the same hue.
      expect(toOklch(better ?? "").l).toBeLessThan(toOklch(color).l);
      expect(Math.abs(toOklch(better ?? "").h - toOklch(color).h)).toBeLessThan(
        10,
      );
    }
  });

  it("names each failing pair with its colors and ratio", () => {
    const [check] = failing(derivePalette("#facc15"));
    expect(check).toMatchObject({ theme: "light", needs: 4.5 });
    expect(check?.ratio).toBeLessThan(4.5);
  });
});
