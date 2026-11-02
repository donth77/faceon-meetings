import { describe, expect, it, vi } from "vitest";

import {
  fetchPage,
  pageOf,
  PER_PAGE,
  requestedPage,
  splitRows,
} from "./pagination";

describe("requestedPage", () => {
  it("reads a page number from the address", () => {
    expect(requestedPage("1")).toBe(1);
    expect(requestedPage("2")).toBe(2);
    expect(requestedPage("40")).toBe(40);
  });

  it("means the first page for anything else", () => {
    for (const value of [
      undefined,
      "",
      "0",
      "-2",
      "2.5",
      "1e3",
      " 2",
      "2abc",
      "two",
      "9999999999",
      ["2", "3"],
    ]) {
      expect(requestedPage(value), String(value)).toBe(1);
    }
  });
});

describe("pageOf", () => {
  it("gives the rows a page shows", () => {
    expect(pageOf(1, 34)).toEqual({
      page: 1,
      pageCount: 4,
      total: 34,
      perPage: PER_PAGE,
      offset: 0,
      first: 1,
      last: 10,
    });
    expect(pageOf(2, 34)).toMatchObject({ offset: 10, first: 11, last: 20 });
    expect(pageOf(4, 34)).toMatchObject({ offset: 30, first: 31, last: 34 });
  });

  it("fills the last page exactly when the rows divide evenly", () => {
    expect(pageOf(2, 20)).toMatchObject({
      page: 2,
      pageCount: 2,
      first: 11,
      last: 20,
    });
  });

  it("keeps to the pages there are", () => {
    // Past the end, as when the last row of the last page goes: the last page.
    expect(pageOf(3, 20)).toMatchObject({ page: 2, offset: 10, first: 11 });
    expect(pageOf(99, 5)).toMatchObject({ page: 1, offset: 0, last: 5 });
    expect(pageOf(0, 34)).toMatchObject({ page: 1, offset: 0 });
    expect(pageOf(-3, 34)).toMatchObject({ page: 1, offset: 0 });
  });

  it("makes an empty list one empty page", () => {
    expect(pageOf(1, 0)).toEqual({
      page: 1,
      pageCount: 1,
      total: 0,
      perPage: PER_PAGE,
      offset: 0,
      first: 0,
      last: 0,
    });
    expect(pageOf(4, 0)).toMatchObject({ page: 1, pageCount: 1 });
  });

  it("has one page up to a page's worth of rows, and two after", () => {
    expect(pageOf(1, 10).pageCount).toBe(1);
    expect(pageOf(1, 11).pageCount).toBe(2);
  });

  it("takes another page size", () => {
    expect(pageOf(2, 7, 3)).toMatchObject({
      pageCount: 3,
      offset: 3,
      first: 4,
      last: 6,
    });
  });
});

describe("fetchPage", () => {
  const list = Array.from({ length: 23 }, (_, index) => `row ${index + 1}`);
  const source = () => ({
    count: vi.fn(async () => list.length),
    rows: vi.fn(async (offset: number, limit: number) =>
      list.slice(offset, offset + limit),
    ),
  });

  it("reads the total and the page together", async () => {
    const { count, rows } = source();
    const result = await fetchPage(2, count, rows);
    expect(result.rows).toEqual(list.slice(10, 20));
    expect(result.page).toMatchObject({ page: 2, pageCount: 3, total: 23 });
    expect(count).toHaveBeenCalledTimes(1);
    expect(rows).toHaveBeenCalledTimes(1);
    expect(rows).toHaveBeenCalledWith(10, PER_PAGE);
  });

  it("reads the last page when the page asked for is past the end", async () => {
    const { count, rows } = source();
    const result = await fetchPage(7, count, rows);
    expect(result.rows).toEqual(list.slice(20));
    expect(result.page).toMatchObject({ page: 3, first: 21, last: 23 });
    expect(rows).toHaveBeenLastCalledWith(20, PER_PAGE);
  });

  it("gives an empty first page for an empty list", async () => {
    const result = await fetchPage(
      1,
      async () => 0,
      async () => [],
    );
    expect(result).toEqual({ rows: [], page: pageOf(1, 0) });
  });
});

describe("splitRows", () => {
  /** The page's rows, from a head list and a tail list in a row. */
  function rowsOf(offset: number, head: string[], tail: string[]) {
    const { head: h, tail: t } = splitRows(offset, PER_PAGE, head.length);
    return [
      ...head.slice(h.start, h.end),
      ...tail.slice(t.offset, t.offset + t.limit),
    ];
  }
  const named = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);

  it("pages through the head, then the tail, as one list", () => {
    for (const [headLength, tailLength] of [
      [0, 0],
      [0, 23],
      [3, 0],
      [3, 25],
      [10, 10],
      [12, 3],
      [25, 7],
    ] as const) {
      const head = named("h", headLength);
      const tail = named("t", tailLength);
      const whole = [...head, ...tail];
      for (
        let offset = 0;
        offset < whole.length + PER_PAGE;
        offset += PER_PAGE
      ) {
        expect(
          rowsOf(offset, head, tail),
          `${headLength}+${tailLength}@${offset}`,
        ).toEqual(whole.slice(offset, offset + PER_PAGE));
      }
    }
  });

  it("reads only the tail rows a page needs", () => {
    expect(splitRows(0, 10, 3)).toEqual({
      head: { start: 0, end: 3 },
      tail: { offset: 0, limit: 7 },
    });
    expect(splitRows(10, 10, 3)).toEqual({
      head: { start: 3, end: 3 },
      tail: { offset: 7, limit: 10 },
    });
    expect(splitRows(10, 10, 12)).toEqual({
      head: { start: 10, end: 12 },
      tail: { offset: 0, limit: 8 },
    });
    // A page of the head alone reads nothing from the database.
    expect(splitRows(0, 10, 12).tail.limit).toBe(0);
  });
});
