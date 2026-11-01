export type GridFit = {
  columns: number;
  tileWidth: number;
  tileHeight: number;
};

/**
 * The column count that makes `count` tiles of the given aspect ratio as large as
 * possible inside a box. Ties go to more columns (side by side on wide screens).
 */
export function fitGrid(
  count: number,
  width: number,
  height: number,
  gap: number,
  aspect = 16 / 9,
): GridFit {
  let best: GridFit = { columns: 1, tileWidth: 0, tileHeight: 0 };
  if (count < 1 || width <= 0 || height <= 0) return best;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const maxWidth = (width - gap * (columns - 1)) / columns;
    const maxHeight = (height - gap * (rows - 1)) / rows;
    const tileWidth = Math.min(maxWidth, maxHeight * aspect);
    if (tileWidth >= best.tileWidth) {
      best = { columns, tileWidth, tileHeight: tileWidth / aspect };
    }
  }
  return {
    columns: best.columns,
    tileWidth: Math.floor(best.tileWidth),
    tileHeight: Math.floor(best.tileHeight),
  };
}
