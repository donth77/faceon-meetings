"use client";

import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { RoomStatus } from "../media";
import { useRoomTransition } from "./motion";

/**
 * Says when the connection drops and while it comes back. Marked as a top layer, so a
 * screen reader still hears it while Settings or another dialog is open (React Aria
 * makes everything else outside a dialog inert).
 */
export function ConnectionBanner({ status }: { status: RoomStatus }) {
  const t = useTranslations("Meeting");
  const transition = useRoomTransition();
  return (
    <div
      role="status"
      data-react-aria-top-layer="true"
      className="flex justify-center px-3"
    >
      <AnimatePresence initial={false}>
        {status === "joined" ? null : (
          <motion.p
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={transition}
            className="flex items-center gap-2 overflow-hidden rounded-lg bg-amber-400/15 px-3 text-sm text-amber-100"
          >
            <span className="flex items-center gap-2 py-2">
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t(status === "offline" ? "offline" : "reconnecting")}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
