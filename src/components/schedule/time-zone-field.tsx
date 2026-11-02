"use client";

import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  type Key,
} from "react-aria-components";

import { timeZones, zoneLabel } from "@/lib/time";

import { INPUT } from "./fields";

/** Time zone, as "New York (GMT−05:00)", searchable by city or offset. */
export function TimeZoneField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (timeZone: string) => void;
}) {
  const locale = useLocale();
  const options = useMemo(() => {
    const now = new Date();
    const zones = timeZones();
    if (!zones.includes(value)) zones.push(value);
    return zones
      .map((id) => ({ id, label: zoneLabel(id, locale, now) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale, value]);

  return (
    <ComboBox
      selectedKey={value}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onChange(String(key));
      }}
      defaultItems={options}
      menuTrigger="focus"
      className="flex min-w-0 flex-col gap-1.5"
    >
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="relative">
        <Input className={cn(INPUT, "pr-10")} />
        <Button className="text-muted-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center outline-none">
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <Popover
        placement="bottom start"
        className="bg-popover text-popover-foreground max-h-80 w-(--trigger-width) overflow-auto rounded-xl p-1.5 shadow-[0_16px_40px_rgba(18,22,28,0.18)] ring-1 ring-black/10 outline-none dark:ring-white/10"
      >
        <ListBox className="outline-none">
          {(option: { id: string; label: string }) => (
            <ListBoxItem
              id={option.id}
              textValue={option.label}
              className="data-focused:bg-accent data-selected:text-primary flex min-h-10 cursor-default items-center rounded-lg px-2.5 text-[15px] outline-none data-selected:font-semibold"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
