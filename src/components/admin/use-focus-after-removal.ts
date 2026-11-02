"use client";

import { useEffect, useRef, type RefObject } from "react";

import { focusIsLost } from "@/lib/focus";

/**
 * When a row goes (approved, declined, moved back to demos), the page refreshes without it.
 * A confirm dialog hands focus back to the row's button as it closes, so focus would be
 * lost with the row: call the returned function before refreshing, and when the new rows
 * arrive, focus goes to the section's heading if nothing has it.
 */
export function useFocusAfterRemoval(
  heading: RefObject<HTMLElement | null>,
  rows: unknown,
): () => void {
  const removing = useRef(false);
  useEffect(() => {
    if (!removing.current) return;
    removing.current = false;
    if (focusIsLost()) heading.current?.focus();
  }, [rows, heading]);
  return () => {
    removing.current = true;
  };
}
