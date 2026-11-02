/**
 * brand/brand.json, the inputs `pnpm brand` makes everything from. Only `name`, `color`
 * and `preview.title` are required; paths are relative to the brand folder.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const Hex = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Use a color like #1f5eff.")
  .transform((value) => value.toLowerCase());

const BrandConfig = z
  .object({
    /** The name in the wordmark; use the same one as NEXT_PUBLIC_APP_NAME. */
    name: z.string().trim().min(1),
    /** The one brand color: buttons, links and focus rings in the light theme. */
    color: Hex,
    /** The mark, as SVG: shapes, not text, with holes as holes rather than white. */
    mark: z.string().default("mark.svg"),
    /** Optional: the mark drawn for dark backgrounds. Otherwise it's recolored. */
    markDark: z.string().optional(),
    wordmark: z
      .object({
        /** A TrueType or OpenType font file. */
        font: z.string().default("fonts/BricolageGrotesque_24pt-Bold.ttf"),
        /** Optional: a second weight of the same design to blend with (point-compatible). */
        blendWith: z.string().optional(),
        /** How far toward `blendWith`, from 0 to 1. */
        blend: z.number().min(0).max(1).default(0.5),
        /** Optional: the end of the name drawn in the brand color, as "On" in "FaceOn". */
        accent: z.string().optional(),
        /** Extra space after each letter, in the font's units (1000 to the em, usually). */
        tracking: z.number().default(0),
        /** Extra space between particular letters, e.g. { "Fa": -22 }, in font units. */
        pairs: z.record(z.string().length(2), z.number()).default({}),
        /** The name's color on light and on dark backgrounds. */
        ink: Hex.default("#12161c"),
        inkOnDark: Hex.default("#f5f6f8"),
      })
      .strict()
      .prefault({}),
    /** The name beside the mark, in the mark's own units (its viewBox). */
    lockup: z
      .object({
        /** Height of capital letters. Default: 17/28 of the mark's height. */
        capHeight: z.number().positive().optional(),
        /** Space from the mark to the name. Default: 5/28 of the mark's height. */
        gap: z.number().min(0).optional(),
        /** Where the capitals' middle sits. Default: the mark's middle. */
        middle: z.number().optional(),
      })
      .strict()
      .default({}),
    /** The background of the icons that can't be transparent (iOS, Android). */
    iconBackground: Hex.default("#ffffff"),
    /** The link preview (Open Graph image), 1200 × 630. */
    preview: z
      .object({
        title: z.string().trim().min(1),
        subtitle: z.string().trim().optional(),
        /** Optional: an SVG drawn over the preview's lower part, on the same 1200 × 630 canvas. */
        art: z.string().optional(),
      })
      .strict(),
    /** Optional: colors to use as given instead of working them out from `color`. */
    colors: z
      .object({
        light: z
          .object({
            brandForeground: Hex,
            brandSoft: Hex,
            brandSoftForeground: Hex,
          })
          .partial()
          .strict()
          .optional(),
        dark: z
          .object({
            brand: Hex,
            brandForeground: Hex,
            brandSoft: Hex,
            brandSoftForeground: Hex,
          })
          .partial()
          .strict()
          .optional(),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((config, context) => {
    const accent = config.wordmark.accent;
    if (accent && !config.name.endsWith(accent)) {
      context.addIssue({
        code: "custom",
        path: ["wordmark", "accent"],
        message: `The name "${config.name}" doesn't end with "${accent}".`,
      });
    }
  });

export type BrandConfig = z.infer<typeof BrandConfig>;

/** The config, with its paths made absolute; throws with every problem listed. */
export function readConfig(file: string): BrandConfig & { folder: string } {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Couldn't read ${file}: ${(error as Error).message}`);
  }
  const parsed = BrandConfig.safeParse(json);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "(the file)"}: ${issue.message}`,
    );
    throw new Error(`${file} needs a fix:\n${problems.join("\n")}`);
  }
  const folder = dirname(resolve(file));
  const at = (path: string) => resolve(folder, path);
  const config = parsed.data;
  return {
    ...config,
    folder,
    mark: at(config.mark),
    markDark: config.markDark && at(config.markDark),
    wordmark: {
      ...config.wordmark,
      font: at(config.wordmark.font),
      blendWith: config.wordmark.blendWith && at(config.wordmark.blendWith),
    },
    preview: {
      ...config.preview,
      art: config.preview.art && at(config.preview.art),
    },
  };
}
