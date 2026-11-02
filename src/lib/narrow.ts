/**
 * The value, if it's one of `values`, typed as that union; otherwise undefined. For keys
 * that React Aria hands back as plain strings or numbers.
 */
export function oneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): T | undefined {
  return values.find((candidate) => candidate === value);
}
