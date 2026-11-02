"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "react-aria-components";

import { useIsMobile } from "@/hooks/use-mobile";

import { useRoomTransition } from "./motion";

/**
 * Participants and Chat open here: on desktop they share a column beside the stage
 * (one grows in as the other makes room); on phones each is a bottom sheet over the
 * meeting. Opening moves focus in (to `initialFocus`, else the title), Escape closes
 * it, and usePanels puts focus back afterwards.
 */
export function SidePanel({
  title,
  closeLabel,
  onClose,
  actions,
  footer,
  initialFocus,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  /** Buttons beside Close. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Where focus goes as the panel opens (the chat box, say); the title otherwise. */
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const phone = useIsMobile();
  const transition = useRoomTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    (initialFocus?.current ?? heading.current)?.focus({ preventScroll: true });
  }, [initialFocus]);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <>
      {phone ? (
        // Tapping the meeting behind the sheet closes it.
        <motion.div
          aria-hidden="true"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="fixed inset-0 z-30 bg-black/50"
        />
      ) : null}
      <motion.aside
        aria-label={title}
        onKeyDown={handleKeyDown}
        initial={phone ? { y: "100%" } : { opacity: 0, flexGrow: 0 }}
        animate={phone ? { y: 0 } : { opacity: 1, flexGrow: 1 }}
        exit={phone ? { y: "100%" } : { opacity: 0, flexGrow: 0 }}
        transition={transition}
        className="bg-card z-40 flex min-h-0 flex-col overflow-hidden max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:h-[78dvh] max-md:rounded-t-2xl max-md:pb-[env(safe-area-inset-bottom)] md:basis-0 md:rounded-2xl"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/20 md:hidden"
        />
        <div className="flex shrink-0 items-center justify-between py-2 pr-2 pl-5">
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-lg font-bold outline-none"
          >
            {title}
          </h2>
          <div className="flex items-center">
            {actions}
            <Button
              aria-label={closeLabel}
              onPress={onClose}
              className="text-foreground/80 focus-visible:focus-ring flex size-10 items-center justify-center rounded-xl outline-hidden hover:bg-white/10"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer ? (
          <div className="flex shrink-0 gap-2 border-t px-4 pt-3 pb-4">
            {footer}
          </div>
        ) : null}
      </motion.aside>
    </>
  );
}
