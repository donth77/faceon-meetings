"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

/** Vercel's component and the redaction, in a chunk of their own (page-view-counter.tsx). */
const PageViewCounter = dynamic(
  () => import("./page-view-counter").then((module) => module.PageViewCounter),
  { ssr: false },
);

const subscribeNever = () => () => {};

/**
 * Counts page views with Vercel Web Analytics, where this copy turns it on
 * (NEXT_PUBLIC_VERCEL_ANALYTICS; the locale layout decides). Nothing renders while a page
 * is prerendered or hydrates, so the static shells stay as they are; once the page is
 * interactive, the counter's code loads, and Vercel's script after it.
 */
export function PageViews() {
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return hydrated ? <PageViewCounter /> : null;
}
