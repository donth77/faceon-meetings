import { useCallback, useState } from "react";

export type ElementSize = { width: number; height: number };

/** An element's content-box size, kept current with a ResizeObserver. Attach the returned ref. */
export function useElementSize<T extends HTMLElement>(): [
  ElementSize,
  (node: T | null) => (() => void) | undefined,
] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const ref = useCallback((node: T | null) => {
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [size, ref];
}
