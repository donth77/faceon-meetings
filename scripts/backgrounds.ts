// Writes the abstract default backgrounds, public/backgrounds/{blue,mint,dusk,graphite}.svg:
// soft gradients and shapes in FaceOn's colours, as SVG so they're tiny and sharp at any
// size. Calm and low in detail, so they cost little to send. Run: node scripts/backgrounds.ts
import { writeFileSync } from "node:fs";

const WIDTH = 1920;
const HEIGHT = 1080;

type Glow = { x: number; y: number; r: number; color: string; opacity: number };

/** A diagonal gradient with soft glows of colour over it. */
function svg(id: string, stops: string[], glows: Glow[], extra = ""): string {
  const gradientStops = stops
    .map(
      (color, index) =>
        `<stop offset="${(index / (stops.length - 1)).toFixed(2)}" stop-color="${color}"/>`,
    )
    .join("");
  const glowDefs = glows
    .map(
      (glow, index) =>
        `<radialGradient id="${id}-g${index}"><stop offset="0" stop-color="${glow.color}" stop-opacity="${glow.opacity}"/><stop offset="1" stop-color="${glow.color}" stop-opacity="0"/></radialGradient>`,
    )
    .join("");
  const glowShapes = glows
    .map(
      (glow, index) =>
        `<circle cx="${glow.x}" cy="${glow.y}" r="${glow.r}" fill="url(#${id}-g${index})"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs><linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">${gradientStops}</linearGradient>${glowDefs}</defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#${id}-bg)"/>${glowShapes}${extra}</svg>\n`;
}

/** Gentle curves across the frame, for depth. */
const waves = (color: string, opacity: number) =>
  [0, 1, 2]
    .map((index) => {
      const y = 640 + index * 120;
      return `<path d="M0 ${y} C 480 ${y - 140}, 1100 ${y + 120}, 1920 ${y - 60} L 1920 1080 L 0 1080 Z" fill="${color}" fill-opacity="${opacity}"/>`;
    })
    .join("");

/** Faint rings around a point off to one side. */
const rings = (color: string) =>
  [260, 420, 580, 740, 900]
    .map(
      (r) =>
        `<circle cx="1500" cy="300" r="${r}" fill="none" stroke="${color}" stroke-opacity="0.06" stroke-width="2"/>`,
    )
    .join("");

const backgrounds: Record<string, string> = {
  blue: svg(
    "blue",
    ["#0b2a8f", "#1f5eff", "#7ea4ff"],
    [
      { x: 1500, y: 260, r: 520, color: "#ffffff", opacity: 0.22 },
      { x: 300, y: 900, r: 620, color: "#4d7eff", opacity: 0.45 },
    ],
    waves("#0b2a8f", 0.12),
  ),
  mint: svg(
    "mint",
    ["#0b5c55", "#1a9c84", "#bdf0dd"],
    [
      { x: 1600, y: 200, r: 560, color: "#ffffff", opacity: 0.25 },
      { x: 200, y: 950, r: 600, color: "#1db46b", opacity: 0.35 },
    ],
    waves("#0b5c55", 0.1),
  ),
  dusk: svg(
    "dusk",
    ["#241a4f", "#7a3b96", "#ff9a7a"],
    [
      { x: 1350, y: 760, r: 360, color: "#ffd2a6", opacity: 0.7 },
      { x: 300, y: 200, r: 600, color: "#4d7eff", opacity: 0.25 },
    ],
  ),
  graphite: svg(
    "graphite",
    ["#121519", "#22272f", "#323946"],
    [
      { x: 1500, y: 300, r: 700, color: "#4d7eff", opacity: 0.12 },
      { x: 250, y: 950, r: 500, color: "#ffffff", opacity: 0.05 },
    ],
    rings("#ffffff"),
  ),
};

for (const [id, content] of Object.entries(backgrounds)) {
  writeFileSync(
    new URL(`../public/backgrounds/${id}.svg`, import.meta.url),
    content,
  );
}
