import { describe, expect, it } from "vitest";

import { createReuser, reuseItems, shallowEqual } from "./reuse";

type Person = { key: string; name: string; muted: boolean };
const keyOf = (person: Person) => person.key;

describe("shallowEqual", () => {
  it("compares each value", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(shallowEqual({ a: 1, b: "x" }, { a: 2, b: "x" })).toBe(false);
    expect(shallowEqual({ a: Number.NaN }, { a: Number.NaN })).toBe(true);
  });

  it("notices a missing or extra key", () => {
    expect(shallowEqual<object>({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("reuseItems", () => {
  const ann = { key: "a", name: "Ann", muted: false };
  const ben = { key: "b", name: "Ben", muted: true };

  it("keeps the previous list when nothing changed", () => {
    const previous = [ann, ben];
    const next = reuseItems(
      previous,
      [{ ...ann }, { ...ben }],
      keyOf,
      shallowEqual,
    );
    expect(next).toBe(previous);
  });

  it("keeps unchanged items when one changes", () => {
    const previous = [ann, ben];
    const next = reuseItems(
      previous,
      [{ ...ann }, { ...ben, muted: false }],
      keyOf,
      shallowEqual,
    );
    expect(next).not.toBe(previous);
    expect(next[0]).toBe(ann);
    expect(next[1]).toEqual({ ...ben, muted: false });
    expect(next[1]).not.toBe(ben);
  });

  it("notices joins, leaves and a new order", () => {
    const previous = [ann, ben];
    expect(reuseItems(previous, [{ ...ann }], keyOf, shallowEqual)).toEqual([
      ann,
    ]);
    const reordered = reuseItems(
      previous,
      [{ ...ben }, { ...ann }],
      keyOf,
      shallowEqual,
    );
    expect(reordered).not.toBe(previous);
    expect(reordered[0]).toBe(ben);
    expect(reordered[1]).toBe(ann);
  });

  it("compares with the given test", () => {
    const sameKey = () => true;
    const previous = [ann];
    expect(
      reuseItems(previous, [{ ...ann, name: "Anne" }], keyOf, sameKey),
    ).toBe(previous);
  });
});

describe("createReuser", () => {
  it("remembers the last list", () => {
    const reuse = createReuser<Person>(keyOf);
    const first = reuse([{ key: "a", name: "Ann", muted: false }]);
    const second = reuse([{ key: "a", name: "Ann", muted: false }]);
    expect(second).toBe(first);
    const third = reuse([{ key: "a", name: "Ann", muted: true }]);
    expect(third).not.toBe(first);
    expect(reuse([{ key: "a", name: "Ann", muted: true }])).toBe(third);
  });
});
