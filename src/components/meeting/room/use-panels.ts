"use client";

import { useRef, useState } from "react";

import type { PanelName } from "./control-bar";

/** The order panels stack in on desktop; Backgrounds and effects takes the column alone. */
const ORDER: readonly PanelName[] = ["people", "chat", "notes", "effects"];

/** Whether focus can go to this element: it's on the page, showing, and not inert. */
const canFocus = (
  element: Element | null | undefined,
): element is HTMLElement =>
  element instanceof HTMLElement &&
  element.isConnected &&
  element.getClientRects().length > 0 &&
  element.closest("[inert]") === null;

/**
 * The side panels: Participants and Chat can both be open on desktop (then AI notes);
 * a phone shows the one opened last, as a sheet. Closing a panel puts focus back where
 * it was before it opened, or on its button, or on More (2.4.3); the panel itself
 * moves focus in as it opens (SidePanel).
 */
export function usePanels({
  phone,
  isHost,
  onOpen,
}: {
  phone: boolean;
  isHost: boolean;
  onOpen?: (panel: PanelName) => void;
}) {
  const [open, setOpen] = useState<PanelName[]>([]);
  const returnTo = useRef(new Map<PanelName, Element | null>());

  function openPanel(next: PanelName) {
    if (!open.includes(next)) {
      returnTo.current.set(next, document.activeElement);
    }
    setOpen((current) =>
      current.includes(next)
        ? current
        : phone || next === "effects"
          ? [next]
          : [...current.filter((panel) => panel !== "effects"), next],
    );
    onOpen?.(next);
  }

  function closePanel(name: PanelName) {
    setOpen((current) => current.filter((panel) => panel !== name));
    const before = returnTo.current.get(name);
    returnTo.current.delete(name);
    // Once the panel has gone (and the room isn't inert any more).
    requestAnimationFrame(() => {
      const target = [
        before,
        document.querySelector(`[data-panel-toggle="${name}"]`),
        ...document.querySelectorAll("[data-more-menu]"),
      ].find(canFocus);
      target?.focus();
    });
  }

  function togglePanel(next: PanelName) {
    if (open.includes(next)) closePanel(next);
    else openPanel(next);
  }

  const shown = (
    phone ? open.slice(-1) : ORDER.filter((name) => open.includes(name))
  ).filter((name) => name !== "notes" || isHost);

  return { open, shown, openPanel, closePanel, togglePanel };
}
