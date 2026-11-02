"use client";

import { parseDate, type CalendarDate } from "@internationalized/date";
import { cn } from "cn";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
} from "react-aria-components";

import { FIELD_POPOVER, INPUT } from "@/components/ui/form-fields";
import { useIntlLocale } from "@/lib/preferences";

const formatted = (date: string, locale: string) => {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
};

/**
 * A date as "Tue, Nov 3, 2026" that opens a month calendar. The value is a local date,
 * "YYYY-MM-DD".
 */
export function DateField({
  id,
  labelId,
  value,
  onChange,
  minValue,
  maxValue,
  previousLabel,
  nextLabel,
}: {
  id?: string;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  /** The earliest date to offer ("YYYY-MM-DD"). */
  minValue?: string;
  /** The latest date to offer ("YYYY-MM-DD"). */
  maxValue?: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const locale = useIntlLocale();
  return (
    <DialogTrigger>
      <Button
        id={id}
        aria-labelledby={labelId}
        className={cn(INPUT, "flex items-center gap-2 text-left")}
      >
        <span className="min-w-0 flex-1 truncate">
          {formatted(value, locale)}
        </span>
        <CalendarDays
          className="text-muted-foreground size-[18px] shrink-0"
          aria-hidden="true"
        />
      </Button>
      <Popover placement="bottom start" className={cn(FIELD_POPOVER, "p-3")}>
        <Dialog aria-labelledby={labelId} className="outline-none">
          {({ close }) => (
            <Calendar
              value={parseDate(value)}
              minValue={minValue ? parseDate(minValue) : undefined}
              maxValue={maxValue ? parseDate(maxValue) : undefined}
              onChange={(date: CalendarDate) => {
                onChange(date.toString());
                close();
              }}
              className="flex flex-col gap-2"
            >
              <header className="flex items-center justify-between gap-2">
                <Button
                  slot="previous"
                  aria-label={previousLabel}
                  className="focus-visible:ring-ring hover:bg-accent flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </Button>
                <Heading className="text-[15px] font-bold" />
                <Button
                  slot="next"
                  aria-label={nextLabel}
                  className="focus-visible:ring-ring hover:bg-accent flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </Button>
              </header>
              <CalendarGrid className="border-separate border-spacing-0.5">
                <CalendarGridHeader>
                  {(day) => (
                    <CalendarHeaderCell className="text-muted-foreground text-xs font-bold">
                      {day}
                    </CalendarHeaderCell>
                  )}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => (
                    <CalendarCell
                      date={date}
                      className="data-focus-visible:ring-ring data-hovered:bg-accent data-selected:bg-primary data-selected:text-primary-foreground data-disabled:text-muted-foreground/50 data-outside-month:text-muted-foreground/60 flex size-9 cursor-default items-center justify-center rounded-lg text-sm outline-none data-focus-visible:ring-2"
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
