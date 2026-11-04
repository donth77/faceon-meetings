import { z } from "@/lib/zod";

/** Rows on a page of a list paged on the server (Settings → Admin's lists). */
export const PER_PAGE = 10;

/** Where a page sits in its list: what the pager shows, and what the query skips. */
export type ListPage = {
  /** 1-based, and always one of the list's pages. */
  page: number;
  /** At least 1: an empty list is one empty page. */
  pageCount: number;
  total: number;
  perPage: number;
  /** Rows before this page, for the query's offset. */
  offset: number;
  /** The rows shown, counted from 1 ("11–20 of 34"); both 0 on an empty list. */
  first: number;
  last: number;
};

/** A page number from the address: digits only, from 1. */
const PageNumber = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number)
  .pipe(z.number().int().min(1));

/** The page asked for in a search param (`?hosts=2`). Anything else means the first. */
export function requestedPage(value: string | string[] | undefined): number {
  const parsed = PageNumber.safeParse(value);
  return parsed.success ? parsed.data : 1;
}

/**
 * Page `requested` of a list of `total` rows, kept to the pages there are: past the end
 * (the last rows were removed, say) it's the last page.
 */
export function pageOf(
  requested: number,
  total: number,
  perPage = PER_PAGE,
): ListPage {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), pageCount);
  const offset = (page - 1) * perPage;
  return {
    page,
    pageCount,
    total,
    perPage,
    offset,
    first: total === 0 ? 0 : offset + 1,
    last: Math.min(offset + perPage, total),
  };
}

/**
 * A page of a list and its total. The total and the page asked for are read together;
 * only when that page is past the end is the last page read after.
 */
export async function fetchPage<Row>(
  requested: number,
  count: () => Promise<number>,
  rows: (offset: number, limit: number) => Promise<Row[]>,
  perPage = PER_PAGE,
): Promise<{ rows: Row[]; page: ListPage }> {
  const asked = Math.max(1, Math.floor(requested) || 1);
  const [total, found] = await Promise.all([
    count(),
    rows((asked - 1) * perPage, perPage),
  ]);
  const page = pageOf(asked, total, perPage);
  return {
    rows: page.page === asked ? found : await rows(page.offset, perPage),
    page,
  };
}

/**
 * The rows `offset` to `offset + limit` of a list made of two lists in a row: a head
 * kept in memory, then a tail read from the database. Which slice of the head that is
 * (`head.start` to `head.end`), and which rows of the tail.
 */
export function splitRows(
  offset: number,
  limit: number,
  headLength: number,
): {
  head: { start: number; end: number };
  tail: { offset: number; limit: number };
} {
  const start = Math.min(offset, headLength);
  const end = Math.min(offset + limit, headLength);
  return {
    head: { start, end },
    tail: {
      offset: Math.max(0, offset - headLength),
      limit: limit - (end - start),
    },
  };
}
