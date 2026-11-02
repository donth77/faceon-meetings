/**
 * Pictures for `pnpm brand`: SVG to PNG (with sharp, which Next.js uses for images), an
 * .ico from PNGs, and measuring where a mark's ink is.
 */
import sharp from "sharp";

import { num, squareAround, svgDocument, type Box, type Mark } from "./svg.ts";

export async function renderPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** An .ico holding PNGs (every current browser and Windows reads these). */
export function ico(pngs: Buffer[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map((png) => {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}

export type Ink = {
  /** The box around everything the mark draws, in its own units. */
  box: Box;
  /** How far the farthest ink is from the box's center, in the same units. */
  reach: number;
};

/**
 * Where the mark's ink is, found by drawing it 4096 pixels across: exact for any SVG,
 * whatever its shapes, strokes, clips or transforms. Edges snap to a fine grid (1/8 of a
 * unit for a 256-unit mark), so ones on whole numbers come out exact.
 */
export async function measureInk(mark: Mark): Promise<Ink> {
  const { viewBox } = mark;
  const scale = 4096 / Math.max(viewBox.width, viewBox.height);
  const width = Math.round(viewBox.width * scale);
  const height = Math.round(viewBox.height * scale);
  const { data } = await sharp(
    Buffer.from(svgDocument(mark.inner, viewBox, { width, height })),
  )
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (data[row + x] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) throw new Error("The mark doesn't draw anything.");
  const grid =
    2 ** Math.floor(Math.log2(Math.max(viewBox.width, viewBox.height) / 2048));
  const snap = (value: number) => Math.round(value / grid) * grid;
  const box = {
    x: snap(viewBox.x + left / scale),
    y: snap(viewBox.y + top / scale),
    width: snap((right + 1 - left) / scale),
    height: snap((bottom + 1 - top) / scale),
  };
  // The farthest inked pixel corner from the center, for icons cropped to a circle.
  const cx = (left + right + 1) / 2;
  const cy = (top + bottom + 1) / 2;
  let reach = 0;
  for (let y = top; y <= bottom; y++) {
    const row = y * width;
    for (let x = left; x <= right; x++) {
      if (data[row + x] === 0) continue;
      const dx = Math.max(Math.abs(x - cx), Math.abs(x + 1 - cx));
      const dy = Math.max(Math.abs(y - cy), Math.abs(y + 1 - cy));
      reach = Math.max(reach, Math.hypot(dx, dy));
    }
  }
  return { box, reach: reach / scale };
}

/** The mark on its own square, `size` pixels, its ink `fraction` of the side. */
export function iconSvg(
  mark: Mark,
  ink: Box,
  size: number,
  fraction: number,
  background?: string,
): string {
  const square = squareAround(ink, fraction);
  const fill = background
    ? `<rect x="${num(square.x)}" y="${num(square.y)}" width="${num(square.width)}" height="${num(square.height)}" fill="${background}"/>`
    : "";
  return svgDocument(`${fill}${mark.inner}`, square, {
    width: size,
    height: size,
  });
}
