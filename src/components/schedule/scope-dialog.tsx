"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SeriesScope } from "@/lib/meetings/schedule";

/** For a series: does the edit apply to this meeting, it and the ones after, or all? */
export function ScopeDialog({
  title,
  confirm,
  destructive,
  onConfirm,
  onClose,
}: {
  title: string;
  confirm: string;
  destructive?: boolean;
  onConfirm: (scope: SeriesScope) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Schedule");
  const [scope, setScope] = useState<SeriesScope>("this");
  const titleId = useId();
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeLabel={t("cancel")}
      className="sm:max-w-[380px]"
    >
      <DialogHeader>
        <DialogTitle id={titleId} className="text-xl font-bold">
          {title}
        </DialogTitle>
      </DialogHeader>
      <RadioGroup
        aria-labelledby={titleId}
        value={scope}
        onChange={(value) => setScope(value as SeriesScope)}
        className="flex flex-col gap-0.5"
      >
        {(["this", "following", "all"] as const).map((value) => (
          <Radio
            key={value}
            value={value}
            className="group flex min-h-10 cursor-default items-center gap-3 text-[15px] outline-none"
          >
            <span
              aria-hidden="true"
              className="group-data-focus-visible:ring-ring flex size-[18px] items-center justify-center rounded-full border-2 border-[#c9cfd8] group-data-focus-visible:ring-2 group-data-selected:border-[#1f5eff]"
            >
              <span className="hidden size-2 rounded-full bg-[#1f5eff] group-data-selected:block" />
            </span>
            {t(`scope.${value}`)}
          </Radio>
        ))}
      </RadioGroup>
      <DialogFooter>
        <Button variant="ghost" onPress={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          onPress={() => onConfirm(scope)}
          autoFocus
        >
          {confirm}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
