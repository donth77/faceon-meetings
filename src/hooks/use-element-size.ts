import { useCallback, useState } from "react";

export type ElementSize = { width: number; height: number };

/** The element's content box now: its box without padding and borders. */
function contentBox(node: HTMLElement): ElementSize {
  const box = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  const sum = (...values: string[]) =>
    values.reduce((total, value) => total + (parseFloat(value) || 0), 0);
  return {
    width: Math.max(
      0,
      box.width -
        sum(
          style.paddingLeft,
          style.paddingRight,
          style.borderLeftWidth,
          style.borderRightWidth,
        ),
    ),
    height: Math.max(
      0,
      box.height -
        sum(
          style.paddingTop,
          style.paddingBottom,
          style.borderTopWidth,
          style.borderBottomWidth,
        ),
    ),
  };
}

/**
 * An element's content-box size, kept current with a ResizeObserver. Attach the returned
 * ref. It's measured as soon as the element is attached, before the browser paints, so
 * what's laid out from it never starts at 0×0: a video shown at that size would ask the
 * media server for nothing until the observer's first report.
 */
export function useElementSize<T extends HTMLElement>(): [
  ElementSize,
  (node: T | null) => (() => void) | undefined,
] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const ref = useCallback((node: T | null) => {
    if (!node) return undefined;
    const update = ({ width, height }: ElementSize) =>
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    update(contentBox(node));
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [size, ref];
}
