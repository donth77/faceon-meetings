/**
 * Keeping objects the same from one render to the next when nothing in them changed, so
 * whatever shows them doesn't redraw. For lists rebuilt from a source that changes more
 * often than what they show (Stream's participant list changes with every audio level).
 */

/** Whether two flat objects have the same keys with the same values. */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as Array<keyof T>;
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.is(a[key], b[key]));
}

/**
 * The previous list itself when no item changed (matched by `keyOf`, compared with
 * `same`); otherwise a new list that keeps each unchanged item from the previous one.
 */
export function reuseItems<T>(
  previous: T[],
  next: T[],
  keyOf: (item: T) => string,
  same: (a: T, b: T) => boolean,
): T[] {
  const before = new Map(previous.map((item) => [keyOf(item), item]));
  let changed = previous.length !== next.length;
  const result = next.map((item, index) => {
    const earlier = before.get(keyOf(item));
    if (earlier !== undefined && same(earlier, item)) {
      if (previous[index] !== earlier) changed = true;
      return earlier;
    }
    changed = true;
    return item;
  });
  return changed ? result : previous;
}

/** reuseItems with its own memory of the last list: give it each new one. */
export function createReuser<T extends object>(
  keyOf: (item: T) => string,
  same: (a: T, b: T) => boolean = shallowEqual,
): (next: T[]) => T[] {
  let last: T[] = [];
  return (next) => {
    last = reuseItems(last, next, keyOf, same);
    return last;
  };
}
