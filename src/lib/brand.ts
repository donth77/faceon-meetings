// Written by `pnpm brand` from brand/brand.json: change that and run it again rather
// than editing this file.

/** The brand's colors, for what CSS can't reach: emails and the offline page. */
export const BRAND_COLORS = {
  light: {
    brand: "#1f5eff",
    brandForeground: "#ffffff",
    brandSoft: "#e8eeff",
    brandSoftForeground: "#1a4fd6",
  },
  dark: {
    brand: "#4d7eff",
    brandForeground: "#0b0f17",
    brandSoft: "#1b2440",
    brandSoftForeground: "#7499ff",
  },
} as const;

/** The logo with the name beside it (public/brand/logo-lockup*.svg), in pixels. */
export const LOCKUP_SIZE = { width: 979, height: 224 } as const;
