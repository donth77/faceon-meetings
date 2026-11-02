/**
 * The stage's layout maths: what shape each tile may take, how large it can be, and
 * where the strip goes beside a large tile. Pure, so it's tested without a browser.
 */

/** A box, in CSS pixels. */
export type Size = { width: number; height: number };

/** The shapes a tile may take, as width over height. */
export type AspectRange = { min: number; max: number };

/** A camera's shape until its picture says otherwise, and the strip's tiles. */
export const WIDESCREEN = 16 / 9;

/**
 * How much of a camera's picture a tile may crop to fill its space: a fifth of its width
 * or height. Past that, the tile keeps the rest of the picture's shape instead.
 */
export const CROP_LIMIT = 0.2;

/** Any shape: a tile showing someone's avatar fills whatever space it has. */
export const ANY_SHAPE: AspectRange = { min: 0, max: Number.POSITIVE_INFINITY };

/** Rounding in the maths never counts as a different shape. */
const TOLERANCE = 1e-9;

/** A picture of this shape, cropped by no more than the limit. */
export function croppable(aspect: number, limit = CROP_LIMIT): AspectRange {
  return { min: aspect * (1 - limit), max: aspect / (1 - limit) };
}

/** Exactly this shape: a shared screen is never cropped. */
export function exactly(aspect: number): AspectRange {
  return { min: aspect, max: aspect };
}

/** The shape in `range` closest to `preferred`. */
export function nearestShape(preferred: number, range: AspectRange): number {
  return Math.min(Math.max(preferred, range.min), range.max);
}

/** The largest box of a shape in `range` that fits in `width` × `height`. */
export function fitBox(
  width: number,
  height: number,
  range: AspectRange,
): Size {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const aspect = width / height;
  if (aspect > range.max * (1 + TOLERANCE)) {
    return {
      width: Math.floor(height * range.max),
      height: Math.floor(height),
    };
  }
  if (aspect < range.min * (1 - TOLERANCE)) {
    return { width: Math.floor(width), height: Math.floor(width / range.min) };
  }
  return { width: Math.floor(width), height: Math.floor(height) };
}

export type GridFit = {
  columns: number;
  tileWidth: number;
  tileHeight: number;
};

/**
 * The column count that makes `count` same-sized tiles, each a shape in `range`, as
 * large as possible inside a box. Ties go to more columns (side by side on wide screens).
 */
export function fitGrid(
  count: number,
  width: number,
  height: number,
  gap: number,
  range: AspectRange = exactly(WIDESCREEN),
): GridFit {
  let best: GridFit = { columns: 1, tileWidth: 0, tileHeight: 0 };
  if (count < 1 || width <= 0 || height <= 0) return best;
  let bestArea = -1;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const tile = fitBox(
      (width - gap * (columns - 1)) / columns,
      (height - gap * (rows - 1)) / rows,
      range,
    );
    const area = tile.width * tile.height;
    if (area >= bestArea) {
      bestArea = area;
      best = { columns, tileWidth: tile.width, tileHeight: tile.height };
    }
  }
  return best;
}

/**
 * The strip's tiles are 16:9, about a fifth of the stage across: from the height of a
 * phone's row (96 px) up to a comfortable thumbnail.
 */
const STRIP = { share: 0.18, minWidth: 171, maxWidth: 256 };

export type FocusFit = {
  /** Beside the large tile, in a row under it, or none when the strip is empty. */
  strip: "side" | "row" | null;
  /** Each tile in the strip. */
  stripTile: Size;
  /** The large tile. */
  main: Size;
};

/**
 * One large tile and a strip of the rest. The strip goes where it costs the large tile
 * least: beside it on a wide stage, in a row under it on a tall one. `placeBy` decides
 * that (a camera's shape, whether or not it's on, so a camera going on or off doesn't
 * move the strip); `main` is the shapes the large tile may take now.
 */
export function fitFocus({
  width,
  height,
  gap,
  stripCount,
  main,
  placeBy = main,
}: {
  width: number;
  height: number;
  gap: number;
  stripCount: number;
  main: AspectRange;
  placeBy?: AspectRange;
}): FocusFit {
  if (stripCount < 1 || width <= 0 || height <= 0) {
    return {
      strip: null,
      stripTile: { width: 0, height: 0 },
      main: fitBox(width, height, main),
    };
  }
  const tileWidth = Math.min(
    STRIP.maxWidth,
    Math.max(
      STRIP.minWidth,
      Math.round(Math.min(width, height * WIDESCREEN) * STRIP.share),
    ),
  );
  const stripTile = {
    width: tileWidth,
    height: Math.round(tileWidth / WIDESCREEN),
  };
  const besideArea = { width: width - stripTile.width - gap, height };
  const underArea = { width, height: height - stripTile.height - gap };
  const area = ({ width: w, height: h }: Size, range: AspectRange) => {
    const box = fitBox(w, h, range);
    return box.width * box.height;
  };
  const beside = area(besideArea, placeBy);
  const under = area(underArea, placeBy);
  const strip =
    beside > under || (beside === under && width >= height) ? "side" : "row";
  const room = strip === "side" ? besideArea : underArea;
  return { strip, stripTile, main: fitBox(room.width, room.height, main) };
}

/**
 * Your floating tile's shape and how wide it is beside the usual 16:9 one, keeping the
 * same area: your camera's shape, cropped within the limit, or 16:9 with it off.
 */
export function floatingShape(cameraAspect: number | null): {
  aspect: number;
  widthScale: number;
} {
  const aspect =
    cameraAspect === null
      ? WIDESCREEN
      : nearestShape(WIDESCREEN, croppable(cameraAspect));
  return { aspect, widthScale: Math.sqrt(aspect / WIDESCREEN) };
}
