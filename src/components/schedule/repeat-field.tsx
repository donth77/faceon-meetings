"use client";

import { cn } from "cn";
import { Check, ChevronDown, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Radio,
  RadioGroup,
  Select,
  SelectValue,
  ToggleButton,
  type Key,
} from "react-aria-components";

import { Button as UIButton } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeRecurrence, presetLabel } from "@/lib/meetings/describe";
import {
  latestSeriesEnd,
  presetOf,
  presetRecurrence,
  REPEAT_PRESETS,
  startFacts,
  WEEKDAYS,
  type Recurrence,
  type RepeatPreset,
  type Weekday,
} from "@/lib/meetings/recurrence";
import { useIntlLocale } from "@/lib/preferences";

import { DateField } from "./date-field";
import { INPUT, RadioDot } from "./fields";

const NUMBER =
  "bg-background focus-visible:ring-ring h-10 w-16 rounded-[10px] border border-[#c9cfd8] px-2.5 text-[15px] outline-none focus-visible:ring-2 dark:border-white/15";
const RADIO =
  "group flex min-h-10 cursor-default items-center gap-3 text-[15px] outline-none";

/** Days of the week in the reader's order: Sunday first in the US, Monday in Europe. */
function weekOrder(locale: string): Weekday[] {
  const info = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const firstDay =
    info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay ?? 7;
  const start = (firstDay + 6) % 7; // 1 = Monday → index 0
  return [...WEEKDAYS.slice(start), ...WEEKDAYS.slice(0, start)];
}

const dayName = (day: Weekday, locale: string, width: "long" | "narrow") =>
  new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 10, 2 + WEEKDAYS.indexOf(day), 12)),
  );

/** The Custom recurrence dialog: every n units, on which days, and when it ends. */
function CustomDialog({
  startDate,
  initial,
  onDone,
  onClose,
}: {
  startDate: string;
  initial: Recurrence;
  onDone: (recurrence: Recurrence) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Schedule");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const facts = startFacts(startDate);
  const [draft, setDraft] = useState<Recurrence>(initial);
  const everyId = useId();
  const onId = useId();
  const endsId = useId();
  const untilId = useId();
  const update = (patch: Partial<Recurrence>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const days = draft.byDay?.length ? draft.byDay : [facts.weekday];
  const untilDate =
    draft.end.kind === "on" ? draft.end.date : addMonths(startDate, 3);
  const count = draft.end.kind === "after" ? draft.end.count : 13;

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeLabel={t("cancel")}
      className="sm:max-w-[440px]"
    >
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">
          {t("customTitle")}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor={everyId} className="text-[15px]">
            {t("repeatEvery")}
          </label>
          <input
            id={everyId}
            type="number"
            min={1}
            max={99}
            value={draft.interval}
            onChange={(event) =>
              update({
                interval: Math.min(
                  99,
                  Math.max(1, Number(event.target.value) || 1),
                ),
              })
            }
            className={NUMBER}
          />
          <Select
            aria-label={t("repeatUnit")}
            selectedKey={draft.freq}
            onSelectionChange={(key: Key | null) => {
              const freq = String(key) as Recurrence["freq"];
              update({
                freq,
                byDay: freq === "WEEKLY" ? days : undefined,
                monthly: freq === "MONTHLY" ? "date" : undefined,
              });
            }}
          >
            <Button
              className={cn(
                INPUT,
                "flex h-10 w-32 items-center gap-2 text-left text-[15px]",
              )}
            >
              <SelectValue className="flex-1" />
              <ChevronDown
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
            </Button>
            <Popover className="bg-popover text-popover-foreground min-w-(--trigger-width) rounded-xl p-1.5 shadow-lg ring-1 ring-black/10 outline-none">
              <ListBox className="outline-none">
                {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map(
                  (freq) => (
                    <ListBoxItem
                      key={freq}
                      id={freq}
                      className="data-focused:bg-accent data-focus-visible:focus-ring-inset flex min-h-9 cursor-default items-center rounded-lg px-2.5 text-[15px] outline-hidden"
                    >
                      {t(`unit${freq}`, { count: draft.interval })}
                    </ListBoxItem>
                  ),
                )}
              </ListBox>
            </Popover>
          </Select>
        </div>

        {draft.freq === "WEEKLY" ? (
          <div className="flex flex-col gap-2.5">
            <span id={onId} className="text-[15px]">
              {t("repeatOn")}
            </span>
            <div role="group" aria-labelledby={onId} className="flex gap-1.5">
              {weekOrder(locale).map((day) => (
                <ToggleButton
                  key={day}
                  aria-label={dayName(day, locale, "long")}
                  isSelected={days.includes(day)}
                  onChange={(on) => {
                    const next = on
                      ? [...days, day]
                      : days.filter((d) => d !== day);
                    if (next.length > 0) update({ byDay: next });
                  }}
                  className="data-focus-visible:ring-ring flex size-10 items-center justify-center rounded-full bg-[#eef1f5] text-sm font-bold outline-none data-focus-visible:ring-2 data-selected:bg-[#1f5eff] data-selected:text-white dark:bg-white/10"
                >
                  {dayName(day, locale, "narrow")}
                </ToggleButton>
              ))}
            </div>
          </div>
        ) : null}

        {draft.freq === "MONTHLY" ? (
          <RadioGroup
            aria-label={t("repeatOn")}
            value={draft.monthly ?? "date"}
            onChange={(value) =>
              update({ monthly: value as Recurrence["monthly"] })
            }
            className="flex flex-col gap-0.5"
          >
            <Radio value="date" className={RADIO}>
              <RadioDot />
              {t("monthlyOnDay", { day: facts.day })}
            </Radio>
            <Radio value="weekday" className={RADIO}>
              <RadioDot />
              {tr("monthlyOn", {
                nth: facts.nth === 5 ? 0 : facts.nth,
                weekday: dayName(facts.weekday, locale, "long"),
              })}
            </Radio>
            {facts.isLast && facts.nth !== 5 ? (
              <Radio value="lastWeekday" className={RADIO}>
                <RadioDot />
                {tr("monthlyOn", {
                  nth: 0,
                  weekday: dayName(facts.weekday, locale, "long"),
                })}
              </Radio>
            ) : null}
          </RadioGroup>
        ) : null}

        <RadioGroup
          aria-labelledby={endsId}
          value={draft.end.kind}
          onChange={(kind) =>
            update({
              end:
                kind === "on"
                  ? { kind: "on", date: untilDate }
                  : kind === "after"
                    ? { kind: "after", count }
                    : { kind: "never" },
            })
          }
          className="flex flex-col gap-1"
        >
          <span id={endsId} className="mb-1.5 text-[15px]">
            {t("ends")}
          </span>
          <Radio value="never" className={RADIO}>
            <RadioDot />
            {t("never")}
          </Radio>
          <div className="flex items-center gap-3">
            <Radio value="on" className={RADIO}>
              <RadioDot />
              <span id={untilId}>{t("endsOn")}</span>
            </Radio>
            <div className="ml-auto w-44">
              <DateField
                labelId={untilId}
                value={untilDate}
                minValue={startDate}
                maxValue={latestSeriesEnd(startDate)}
                onChange={(date) => update({ end: { kind: "on", date } })}
                previousLabel={t("previousMonth")}
                nextLabel={t("nextMonth")}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Radio value="after" className={RADIO}>
              <RadioDot />
              {t("endsAfter")}
            </Radio>
            <span className="ml-auto flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={730}
                aria-label={t("occurrencesLabel")}
                value={count}
                onChange={(event) =>
                  update({
                    end: {
                      kind: "after",
                      count: Math.min(
                        730,
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                    },
                  })
                }
                className={NUMBER}
              />
              <span className="text-muted-foreground">
                {t("occurrences", { count })}
              </span>
            </span>
          </div>
        </RadioGroup>

        <p className="bg-muted text-muted-foreground rounded-[10px] px-3 py-2.5 text-sm">
          {describeRecurrence(
            tr,
            { ...draft, byDay: draft.freq === "WEEKLY" ? days : undefined },
            startDate,
            locale,
          )}
        </p>
      </div>
      <DialogFooter>
        <UIButton variant="ghost" onPress={onClose}>
          {t("cancel")}
        </UIButton>
        <UIButton
          onPress={() =>
            onDone({
              ...draft,
              byDay: draft.freq === "WEEKLY" ? days : undefined,
            })
          }
        >
          {t("done")}
        </UIButton>
      </DialogFooter>
    </Dialog>
  );
}

function addMonths(date: string, months: number): string {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, d));
  return next.toISOString().slice(0, 10);
}

/** Repeat: Google Calendar's choices for the chosen day, and Custom…. */
export function RepeatField({
  startDate,
  value,
  onChange,
}: {
  /** The meeting's local start date, "YYYY-MM-DD". */
  startDate: string;
  value: Recurrence | null;
  onChange: (value: Recurrence | null) => void;
}) {
  const t = useTranslations("Schedule");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const facts = startFacts(startDate);
  const current = presetOf(value, facts);
  const [customOpen, setCustomOpen] = useState(false);

  const items: Array<{ id: string; label: string }> = REPEAT_PRESETS.map(
    (preset) => ({ id: preset, label: presetLabel(tr, preset, facts, locale) }),
  );
  if (current === "custom" && value) {
    items.push({
      id: "current",
      label: describeRecurrence(tr, value, startDate, locale),
    });
  }
  items.push({ id: "custom", label: tr("custom") });

  return (
    <>
      <Select
        selectedKey={current === "custom" ? "current" : current}
        onSelectionChange={(key: Key | null) => {
          if (key === "custom") setCustomOpen(true);
          else if (key !== null && key !== "current") {
            onChange(presetRecurrence(key as RepeatPreset, facts));
          }
        }}
        className="flex flex-col gap-1.5"
      >
        <Label className="text-sm font-semibold">{t("repeat")}</Label>
        <Button
          className={cn(
            INPUT,
            "flex w-auto min-w-[280px] items-center gap-2 self-start text-left",
          )}
        >
          <Repeat
            className="text-muted-foreground size-[18px] shrink-0"
            aria-hidden="true"
          />
          <SelectValue className="min-w-0 flex-1 truncate" />
          <ChevronDown
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        </Button>
        <Popover
          placement="bottom start"
          className="bg-popover text-popover-foreground w-[340px] max-w-[calc(100vw-2rem)] rounded-xl p-1.5 shadow-[0_16px_40px_rgba(18,22,28,0.18)] ring-1 ring-black/10 outline-none dark:ring-white/10"
        >
          <ListBox items={items} className="outline-none">
            {(item) => (
              <ListBoxItem
                id={item.id}
                textValue={item.label}
                className={cn(
                  "data-focused:bg-accent data-focus-visible:focus-ring-inset flex min-h-10 cursor-default items-center gap-2 rounded-lg px-2 text-[15px] outline-hidden",
                  item.id === "custom" &&
                    "mt-1 rounded-t-none border-t border-[#e2e5ea] dark:border-white/10",
                )}
              >
                {({ isSelected }) => (
                  <>
                    <span className="text-primary flex w-[18px] justify-center">
                      {isSelected ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : null}
                    </span>
                    {item.label}
                  </>
                )}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
      {customOpen ? (
        <CustomDialog
          startDate={startDate}
          initial={
            value ?? {
              freq: "WEEKLY",
              interval: 1,
              byDay: [facts.weekday],
              end: { kind: "never" },
            }
          }
          onDone={(recurrence) => {
            onChange(recurrence);
            setCustomOpen(false);
          }}
          onClose={() => setCustomOpen(false)}
        />
      ) : null}
    </>
  );
}
