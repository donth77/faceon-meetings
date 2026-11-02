"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { RouterProvider } from "react-aria-components";

import { LinkButton } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { focusIsLost } from "@/lib/focus";
import type { ListPage } from "@/lib/pagination";

type Direction = "previous" | "next";

/**
 * The pager last used. Next.js renders a page anew when its search params change, so the
 * pager that brought the list to its page is gone by the time the page arrives; the new
 * one reads this to put focus back and say which rows it shows.
 */
let lastMove: {
  param: string;
  direction: Direction;
  to: number;
  at: number;
} | null = null;

function rememberMove(param: string, direction: Direction, to: number) {
  lastMove = { param, direction, to, at: Date.now() };
}

/** How this list got to its page, if it was this pager's doing (asked once). */
function takeMove(param: string, page: ListPage): Direction | null {
  const move = lastMove;
  if (
    !move ||
    move.param !== param ||
    // Past the end, the list shows its last page instead.
    Math.min(move.to, page.pageCount) !== page.page ||
    Date.now() - move.at > 30_000
  ) {
    return null;
  }
  lastMove = null;
  return move.direction;
}

/**
 * A list paged on the server, with "11–20 of 34", Previous page and Next page under it
 * when there's more than one page. The page is in the address (`?<param>=2`), so the
 * pages are links: they open in a new tab and come back with Back. While the next page
 * loads, the list dims; when it's there, focus is back on the control that was used (the
 * other one if that's now at its end) and the new rows are announced.
 */
export function Pager({
  label,
  param,
  page,
  children,
}: {
  /** The pager's name, for screen readers: "Pages of approved hosts". */
  label: string;
  /** The search param holding this list's page. */
  param: string;
  page: ListPage;
  /** The list. */
  children: ReactNode;
}) {
  const t = useTranslations("Pager");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nav = useRef<HTMLElement>(null);
  const [pending, startTransition] = useTransition();
  const [moving, setMoving] = useState<Direction | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const range =
    page.first === page.last
      ? t("single", { position: page.first, total: page.total })
      : t("range", { first: page.first, last: page.last, total: page.total });

  function hrefFor(target: number) {
    const query = new URLSearchParams(searchParams.toString());
    if (target > 1) query.set(param, String(target));
    else query.delete(param);
    const search = query.toString();
    return search ? `${pathname}?${search}` : pathname;
  }
  const previousHref = page.page > 1 ? hrefFor(page.page - 1) : undefined;
  const nextHref =
    page.page < page.pageCount ? hrefFor(page.page + 1) : undefined;

  function navigate(href: string, options?: { scroll?: boolean }) {
    const direction = href === nextHref ? "next" : "previous";
    rememberMove(
      param,
      direction,
      direction === "next" ? page.page + 1 : page.page - 1,
    );
    setMoving(direction);
    startTransition(() => router.push(href, options));
  }

  const arrived = useEffectEvent(() => {
    const direction = takeMove(param, page);
    if (!direction) return undefined;
    if (focusIsLost()) {
      const stillThere =
        direction === "next" ? page.page < page.pageCount : page.page > 1;
      const other = direction === "next" ? "previous" : "next";
      nav.current
        ?.querySelector<HTMLElement>(
          `[data-direction="${stillThere ? direction : other}"]`,
        )
        ?.focus();
    }
    // A moment after the status line appears, so screen readers are listening by then;
    // cleared later, so reading the page doesn't come across it twice.
    const announce = window.setTimeout(() => setAnnouncement(range), 150);
    const clear = window.setTimeout(() => setAnnouncement(""), 7000);
    return () => {
      window.clearTimeout(announce);
      window.clearTimeout(clear);
    };
  });
  useEffect(() => arrived(), [page.page]);

  return (
    <>
      <div
        aria-busy={pending || undefined}
        className={cn(
          "transition-opacity motion-reduce:transition-none",
          pending && "opacity-60",
        )}
      >
        {children}
      </div>
      {page.pageCount > 1 ? (
        <RouterProvider navigate={navigate}>
          <nav
            ref={nav}
            aria-label={label}
            className="-my-1 flex items-center justify-end gap-0.5"
          >
            <span className="text-muted-foreground pr-1.5 text-sm tabular-nums">
              {range}
            </span>
            <PageLink
              direction="previous"
              href={previousHref}
              label={t("previous")}
              pending={pending && moving === "previous"}
            />
            <PageLink
              direction="next"
              href={nextHref}
              label={t("next")}
              pending={pending && moving === "next"}
            />
            <p role="status" className="sr-only">
              {announcement}
            </p>
          </nav>
        </RouterProvider>
      ) : null}
    </>
  );
}

/** Previous page or Next page: a link while there's a page that way. */
function PageLink({
  direction,
  href,
  label,
  pending,
}: {
  direction: Direction;
  href: string | undefined;
  label: string;
  pending: boolean;
}) {
  const Arrow = direction === "next" ? ChevronRight : ChevronLeft;
  const link = (
    <LinkButton
      href={href}
      isDisabled={!href}
      routerOptions={{ scroll: false }}
      variant="ghost"
      size="icon"
      aria-label={label}
      data-direction={direction}
      className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
      ) : (
        <Arrow aria-hidden="true" />
      )}
    </LinkButton>
  );
  // A tooltip needs something focusable to describe; at the end there's nothing to say.
  if (!href) return link;
  return (
    <TooltipTrigger delay={300}>
      {link}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
