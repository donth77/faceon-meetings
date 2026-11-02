"use client";

import { Copy, Link2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "react-aria-components";

import type { AdmittedMeetingInfo } from "@/lib/meetings/api";

import { useInvitation } from "../invitation";
import { useRoomTransition } from "./motion";

const actionClass =
  "focus-visible:ring-ring flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold outline-none focus-visible:ring-2";

/**
 * "You're the only one here", as in Meet: the link and an invitation to copy while
 * nobody else has joined. Dismissible; it goes away once someone joins.
 */
export function AloneCard({ meeting }: { meeting: AdmittedMeetingInfo }) {
  const t = useTranslations("Meeting");
  const { link, copyLink, copyInvitation } = useInvitation(meeting);
  const [dismissed, setDismissed] = useState(false);
  const transition = useRoomTransition();

  return (
    <AnimatePresence>
      {dismissed ? null : (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={transition}
          aria-labelledby="alone-title"
          className="bg-card text-card-foreground absolute bottom-3 left-3 z-10 flex w-[min(24rem,calc(100%-1.5rem))] flex-col gap-3 rounded-2xl p-4 shadow-xl ring-1 ring-white/10"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="alone-title" className="font-semibold">
              {t("alone.title")}
            </h2>
            <Button
              aria-label={t("alone.dismiss")}
              onPress={() => setDismissed(true)}
              className="text-muted-foreground focus-visible:ring-ring -mt-1 -mr-1 flex size-8 items-center justify-center rounded-lg outline-none hover:bg-white/10 focus-visible:ring-2"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{t("alone.body")}</p>
          <p className="bg-muted truncate rounded-lg px-3 py-2 font-mono text-xs select-all">
            {link}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onPress={() => void copyLink()}
              className={`bg-primary text-primary-foreground hover:bg-primary/90 ${actionClass}`}
            >
              <Link2 className="size-4" aria-hidden="true" />
              {t("copyLink")}
            </Button>
            <Button
              onPress={() => void copyInvitation()}
              className={`bg-white/10 hover:bg-white/15 ${actionClass}`}
            >
              <Copy className="size-4" aria-hidden="true" />
              {t("copyInvitation")}
            </Button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
