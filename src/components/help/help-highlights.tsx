"use client";

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import {
  findMatches,
  MAX_QUERY_LENGTH,
  type Match,
} from "@/lib/help/highlight";

/** Never highlighted: navigation, hidden and screen-reader-only text, earlier marks. */
const SKIP = "script, style, svg, nav, mark, [aria-hidden='true'], .sr-only";

/** Elements a match may run across (the inline ones). Any other element ends a run. */
const INLINE = new Set([
  "A",
  "ABBR",
  "B",
  "BDI",
  "BDO",
  "CITE",
  "CODE",
  "DATA",
  "DEL",
  "DFN",
  "EM",
  "I",
  "INS",
  "KBD",
  "Q",
  "S",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TIME",
  "U",
  "VAR",
]);

/** The article's text as runs of text nodes (see lib/help/highlight.ts). */
function textRuns(root: Element): Text[][] {
  const runs: Text[][] = [];
  let run: Text[] = [];
  const close = () => {
    if (run.length) runs.push(run);
    run = [];
  };
  const visit = (node: Node) => {
    if (node instanceof Text) {
      if (node.data) run.push(node);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.matches(SKIP)) {
      close();
      return;
    }
    const inline = INLINE.has(node.tagName);
    if (!inline) close();
    for (const child of Array.from(node.childNodes)) visit(child);
    if (!inline) close();
  };
  for (const child of Array.from(root.childNodes)) visit(child);
  close();
  return runs;
}

/**
 * Wraps each match in marks, one per text node it touches. Each text node React made
 * stays in place (shortened); undoing removes what was added and restores its text,
 * so React's own nodes are exactly as they were.
 */
function wrap(runs: Text[][], matches: Match[]) {
  const marks = matches.map((match) =>
    new Array<HTMLElement | undefined>(match.length).fill(undefined),
  );
  const byNode = new Map<
    Text,
    { start: number; end: number; match: number; piece: number }[]
  >();
  matches.forEach((match, matchIndex) =>
    match.forEach((piece, pieceIndex) => {
      const node = runs[piece.run]?.[piece.segment];
      if (!node) return;
      const pieces = byNode.get(node) ?? [];
      pieces.push({ ...piece, match: matchIndex, piece: pieceIndex });
      byNode.set(node, pieces);
    }),
  );
  const touched: { node: Text; data: string; added: ChildNode[] }[] = [];
  for (const [node, pieces] of byNode) {
    const record = { node, data: node.data, added: [] as ChildNode[] };
    // Last first, so splitting one piece off leaves the earlier ones where they were.
    for (const piece of pieces.sort((a, b) => b.start - a.start)) {
      const tail = node.splitText(piece.end);
      const middle = node.splitText(piece.start);
      const mark = document.createElement("mark");
      mark.dataset.helpMatch = "";
      middle.replaceWith(mark);
      mark.append(middle);
      record.added.push(tail, mark);
      const list = marks[piece.match];
      if (list) list[piece.piece] = mark;
    }
    touched.push(record);
  }
  return {
    marks: marks.map((list) =>
      list.filter((mark): mark is HTMLElement => mark !== undefined),
    ),
    undo() {
      for (const { node, data, added } of touched) {
        for (const extra of added) extra.remove();
        node.data = data;
      }
    },
  };
}

type Snapshot = {
  query: string;
  mode: "phrase" | "words";
  marks: HTMLElement[][];
  current: number;
  /** Moved by Next or Previous, rather than found as the page opened. */
  moved: boolean;
};

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Brings a mark into view, unless it's already there. */
function reveal(mark: HTMLElement | undefined, smooth: boolean) {
  if (!mark) return;
  const box = mark.getBoundingClientRect();
  const visible = box.top >= 72 && box.bottom <= window.innerHeight - 24;
  if (!visible) {
    mark.scrollIntoView({
      block: "center",
      behavior: smooth && !reducedMotion() ? "smooth" : "auto",
    });
  }
}

/**
 * The article's marks as a store React reads. They're made when the bar first
 * subscribes (after React has put the article on the page) and removed when it stops,
 * so a new search, or leaving the article, always starts clean.
 */
function highlighter(articleId: string, query: string) {
  let snapshot: Snapshot | null = null;
  let undo: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const show = (current: number) => {
    snapshot?.marks.forEach((match, index) =>
      match.forEach((mark) => {
        if (index === current) mark.dataset.current = "";
        else delete mark.dataset.current;
      }),
    );
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        const article = document.getElementById(articleId);
        if (article && query) {
          const runs = textRuns(article);
          const found = findMatches(
            runs.map((run) => run.map((node) => node.data)),
            query,
          );
          const wrapped = wrap(runs, found.matches);
          undo = wrapped.undo;
          snapshot = {
            query,
            mode: found.mode,
            marks: wrapped.marks,
            current: 0,
            moved: false,
          };
          show(0);
          reveal(wrapped.marks[0]?.[0], false);
          notify();
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        undo?.();
        undo = null;
        snapshot = null;
      };
    },
    getSnapshot: () => snapshot,
    /** Next (1) or previous (-1), round to the other end. */
    go(step: 1 | -1) {
      if (!snapshot?.marks.length) return;
      const count = snapshot.marks.length;
      const current = (snapshot.current + step + count) % count;
      snapshot = { ...snapshot, current, moved: true };
      show(current);
      reveal(snapshot.marks[current]?.[0], true);
      notify();
    },
  };
}

const noMarks = {
  subscribe: () => () => {},
  getSnapshot: () => null,
  go: () => {},
};

function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <TooltipTrigger delay={300}>
      <Button variant="ghost" size="icon" aria-label={label} onPress={onPress}>
        {children}
      </Button>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

/**
 * Above a Help article opened from a search (`?q=`): the search highlighted in the
 * article, how many matches there are, Previous and Next, and Clear. The article is
 * rendered on the server without it; this reads the search in the browser.
 */
export function HelpHighlights({
  articleId,
  titleId,
}: {
  /** The element holding the article's text: only its text is highlighted. */
  articleId: string;
  /** The article's heading, where focus goes when the bar goes. */
  titleId: string;
}) {
  const t = useTranslations("Help.matches");
  const query = (useSearchParams().get("q") ?? "")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
  // A store needs to keep its identity while its search stays the same.
  const store = useMemo(
    () => (query ? highlighter(articleId, query) : noMarks),
    [articleId, query],
  );
  const found = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => null,
  );
  if (!query) return null;

  const count = found?.marks.length ?? 0;
  const summary = !found
    ? t("looking", { query })
    : !count
      ? t("none", { query })
      : found.mode === "phrase"
        ? t("found", { count, query })
        : t("foundWords", { count, query });

  function clear() {
    // The bar is about to go: focus moves to the article first.
    document.getElementById(titleId)?.focus();
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  return (
    <div
      role="region"
      aria-label={t("label")}
      className="bg-card ring-border sticky top-3 z-10 mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-3.5 shadow-sm ring-1"
    >
      <Search
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm leading-snug">{summary}</p>
      <div className="flex items-center gap-0.5">
        {count ? (
          <>
            <span
              aria-hidden="true"
              className="text-muted-foreground px-1.5 text-sm tabular-nums"
            >
              {t("position", { current: (found?.current ?? 0) + 1, count })}
            </span>
            <IconButton label={t("previous")} onPress={() => store.go(-1)}>
              <ChevronUp aria-hidden="true" />
            </IconButton>
            <IconButton label={t("next")} onPress={() => store.go(1)}>
              <ChevronDown aria-hidden="true" />
            </IconButton>
          </>
        ) : null}
        <Button variant="ghost" size="sm" onPress={clear}>
          {t("clear")}
        </Button>
      </div>
      {/* Said once when the search is found, then as Next and Previous move. */}
      <p role="status" className="sr-only">
        {!found
          ? ""
          : found.moved
            ? t("positionSaid", { current: found.current + 1, count })
            : summary}
      </p>
    </div>
  );
}
