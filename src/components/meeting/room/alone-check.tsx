"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNow } from "@/hooks/use-now";

/** How long the question waits for an answer before leaving. */
const ANSWER_SECONDS = 60;

/**
 * After a while alone in a meeting, asks "Are you still there?". Stay starts the clock
 * again; no answer leaves. Someone joining clears it.
 */
export function useAloneCheck(alone: boolean, minutes: number | null) {
  const [askedAt, setAskedAt] = useState<number | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!alone || minutes === null) return;
    const timer = setTimeout(() => setAskedAt(Date.now()), minutes * 60_000);
    return () => {
      clearTimeout(timer);
      // Someone joined (or Stay): the next question starts from scratch.
      setAskedAt(null);
    };
  }, [alone, minutes, round]);

  return {
    askedAt: alone ? askedAt : null,
    stay: () => setRound((n) => n + 1),
  };
}

export function AloneCheckDialog({
  askedAt,
  minutes,
  onStay,
  onLeave,
}: {
  askedAt: number | null;
  minutes: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations("Meeting.aloneCheck");
  const now = useNow(1000);
  const secondsLeft =
    askedAt === null || now === null
      ? ANSWER_SECONDS
      : Math.max(0, ANSWER_SECONDS - Math.floor((now - askedAt) / 1000));
  const timedOut = askedAt !== null && secondsLeft === 0;
  const leave = useEffectEvent(onLeave);

  useEffect(() => {
    if (timedOut) leave();
  }, [timedOut]);

  return (
    <Dialog
      isOpen={askedAt !== null}
      isDismissable={false}
      showCloseButton={false}
      role="alertdialog"
      className="dark"
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {t("title")}
        </DialogTitle>
        <DialogDescription>
          {t("body", { minutes, seconds: secondsLeft })}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onPress={onLeave}>
          {t("leave")}
        </Button>
        <Button onPress={onStay} autoFocus>
          {t("stay")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
