/**
 * The part of a screen someone shares: a box over the captured screen, kept as fractions
 * of its width and height (0 to 1), so it holds when the screen's resolution changes.
 * Pure: the area picker moves and resizes it, and the crop turns it into pixels.
 */
export type Area = { x: number; y: number; width: number; height: number };

/** A point over the screen, as fractions of its width and height. */
export type Point = { x: number; y: number };

/** The box's edges a resize handle moves: any of left, right, top and bottom. */
export type Edges = {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
};

/** The smallest box, as a share of the screen's width and height. */
export const MIN_SHARE = 0.05;

/** How far one arrow key moves or resizes the box: a hundredth of the screen. */
export const KEY_STEP = 0.01;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * The box to start from: 16:9 on the screen, two thirds of whichever side limits it,
 * in the middle. A screen of unknown size gets two thirds each way.
 */
export function initialArea(screenWidth: number, screenHeight: number): Area {
  if (!(screenWidth > 0 && screenHeight > 0)) {
    return { x: 1 / 6, y: 1 / 6, width: 2 / 3, height: 2 / 3 };
  }
  const scale = (2 / 3) * Math.min(screenWidth / 16, screenHeight / 9);
  const width = (16 * scale) / screenWidth;
  const height = (9 * scale) / screenHeight;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/** The box kept on the screen and at least the smallest size. */
export function clampArea(area: Area): Area {
  const width = clamp(area.width, MIN_SHARE, 1);
  const height = clamp(area.height, MIN_SHARE, 1);
  return {
    x: clamp(area.x, 0, 1 - width),
    y: clamp(area.y, 0, 1 - height),
    width,
    height,
  };
}

/** The box moved by `dx` and `dy`, stopping at the screen's edges. */
export function moveArea(area: Area, dx: number, dy: number): Area {
  return clampArea({ ...area, x: area.x + dx, y: area.y + dy });
}

/**
 * The box with some of its edges moved by `dx` and `dy`; the other edges stay where
 * they are. An edge stops at the screen, and short of the opposite one.
 */
export function resizeArea(
  area: Area,
  edges: Edges,
  dx: number,
  dy: number,
): Area {
  let left = area.x;
  let right = area.x + area.width;
  let top = area.y;
  let bottom = area.y + area.height;
  if (edges.left) left = clamp(left + dx, 0, right - MIN_SHARE);
  if (edges.right) right = clamp(right + dx, left + MIN_SHARE, 1);
  if (edges.top) top = clamp(top + dy, 0, bottom - MIN_SHARE);
  if (edges.bottom) bottom = clamp(bottom + dy, top + MIN_SHARE, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** A new box drawn from one corner to the other, at least the smallest size. */
export function areaBetween(from: Point, to: Point): Area {
  const a = { x: clamp(from.x, 0, 1), y: clamp(from.y, 0, 1) };
  const b = { x: clamp(to.x, 0, 1), y: clamp(to.y, 0, 1) };
  return clampArea({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  });
}

/**
 * What a key does to the box: the arrow keys move it, and with Shift they resize it
 * (right and down make it larger, left and up smaller), a hundredth of the screen at a
 * time. Null for any other key.
 */
export function areaAfterKey(
  area: Area,
  key: string,
  shift: boolean,
): Area | null {
  const step = KEY_STEP;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = moves[key];
  if (!move) return null;
  const [dx, dy] = move;
  return shift
    ? resizeArea(area, { right: true, bottom: true }, dx, dy)
    : moveArea(area, dx, dy);
}

/** A rectangle of pixels in a video frame. */
export type PixelRect = { x: number; y: number; width: number; height: number };

const even = (value: number) => Math.max(0, Math.floor(value / 2) * 2);

/**
 * The pixels of a `frameWidth` × `frameHeight` frame that the box covers, on even
 * coordinates and sizes (video formats share colour between pairs of pixels, so a crop
 * must start and end on a pair), and never outside the frame.
 */
export function cropRect(
  area: Area,
  frameWidth: number,
  frameHeight: number,
): PixelRect {
  const box = clampArea(area);
  const x = even(box.x * frameWidth);
  const y = even(box.y * frameHeight);
  const width = Math.max(
    2,
    even(Math.min(box.width * frameWidth, frameWidth - x)),
  );
  const height = Math.max(
    2,
    even(Math.min(box.height * frameHeight, frameHeight - y)),
  );
  return { x, y, width, height };
}
